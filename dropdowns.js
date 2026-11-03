// Shared in-page dropdowns. Hidden selects preserve the existing value/change API.
(() => {
    let openDropdown = null;

    function enhance(select) {
        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select';
        select.before(wrapper);
        wrapper.append(select);
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.id = `${select.id}-trigger`;
        trigger.className = 'custom-select__trigger';
        trigger.setAttribute('role', 'combobox');
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        const label = document.createElement('span');
        label.className = 'custom-select__value';
        const chevron = document.createElement('span');
        chevron.className = 'custom-select__chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '⌄';
        trigger.append(label, chevron);
        wrapper.append(trigger);

        const menu = document.createElement('div');
        menu.id = `${select.id}-options`;
        menu.className = 'custom-select__menu';
        menu.setAttribute('role', 'listbox');
        menu.hidden = true;
        document.body.append(menu);
        trigger.setAttribute('aria-controls', menu.id);
        const fieldLabel = select.labels?.[0];
        const accessibleName = select.getAttribute('aria-label') || fieldLabel?.textContent.trim() || select.id;
        trigger.setAttribute('aria-label', accessibleName);
        menu.setAttribute('aria-label', accessibleName);
        if (fieldLabel?.htmlFor === select.id) fieldLabel.htmlFor = trigger.id;
        select.hidden = true;
        select.tabIndex = -1;

        const options = Array.from(select.options, (option, index) => {
            const item = document.createElement('div');
            item.id = `${menu.id}-${index}`;
            item.className = 'custom-select__option';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-disabled', String(option.disabled));
            item.textContent = option.textContent;
            item.addEventListener('pointermove', () => { if (!option.disabled) activate(index); });
            item.addEventListener('pointerdown', event => event.preventDefault());
            item.addEventListener('click', () => { if (!option.disabled) commit(index); });
            menu.append(item);
            return item;
        });
        let activeIndex = select.selectedIndex;
        let search = '';
        let lastTypedAt = 0;

        function sync() {
            label.textContent = select.selectedOptions[0]?.textContent || '';
            trigger.disabled = select.disabled;
            options.forEach((item, index) => item.setAttribute('aria-selected', String(index === select.selectedIndex)));
            if (menu.hidden) activeIndex = select.selectedIndex;
        }
        function position() {
            const rect = trigger.getBoundingClientRect();
            const gutter = 8;
            const width = Math.min(Math.max(rect.width, 160), window.innerWidth - gutter * 2);
            menu.style.width = `${width}px`;
            const left = select.closest('.theme-control, .sort-field') ? rect.right - width : rect.left;
            menu.style.left = `${Math.max(gutter, Math.min(left, window.innerWidth - width - gutter))}px`;
            const below = window.innerHeight - rect.bottom - gutter - 4;
            const above = rect.top - gutter - 4;
            const flip = below < Math.min(menu.scrollHeight, 260) && above > below;
            menu.style.maxHeight = `${Math.max(36, Math.min(260, flip ? above : below))}px`;
            menu.style.top = `${flip ? Math.max(gutter, rect.top - menu.offsetHeight - 4) : rect.bottom + 4}px`;
        }
        function activate(index) {
            activeIndex = index;
            options.forEach((item, i) => item.classList.toggle('is-active', i === index));
            trigger.setAttribute('aria-activedescendant', options[index].id);
            options[index].scrollIntoView({ block: 'nearest' });
        }
        function close() {
            menu.hidden = true;
            trigger.setAttribute('aria-expanded', 'false');
            trigger.removeAttribute('aria-activedescendant');
            search = '';
            if (openDropdown?.trigger === trigger) openDropdown = null;
        }
        function open() {
            if (trigger.disabled) return;
            openDropdown?.close();
            sync();
            menu.hidden = false;
            trigger.setAttribute('aria-expanded', 'true');
            openDropdown = { trigger, menu, close, position };
            position();
            activate(Math.max(0, select.selectedIndex));
        }
        function commit(index) {
            select.selectedIndex = index;
            sync();
            close();
            trigger.focus({ preventScroll: true });
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        function move(direction) {
            let index = activeIndex;
            do { index = (index + direction + options.length) % options.length; }
            while (select.options[index].disabled && index !== activeIndex);
            activate(index);
        }
        trigger.addEventListener('click', () => menu.hidden ? open() : close());
        trigger.addEventListener('keydown', event => {
            const key = event.key;
            if (key === 'Tab') { close(); return; }
            if (key === 'Escape') {
                if (!menu.hidden) { event.preventDefault(); event.stopPropagation(); close(); }
                return;
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) {
                event.preventDefault();
                if (menu.hidden) {
                    open();
                    if (key === 'Home') activate(0);
                    if (key === 'End') activate(options.length - 1);
                } else if (key === 'Enter' || key === ' ') commit(activeIndex);
                else if (key === 'Home') activate(0);
                else if (key === 'End') activate(options.length - 1);
                else move(key === 'ArrowDown' ? 1 : -1);
            } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                event.preventDefault();
                if (menu.hidden) open();
                search = Date.now() - lastTypedAt < 700 ? search + key : key;
                lastTypedAt = Date.now();
                const index = Array.from(select.options).findIndex(option => !option.disabled
                    && option.textContent.replace(/^[^\p{L}\p{N}]+/u, '').toLocaleLowerCase().startsWith(search.toLocaleLowerCase()));
                if (index >= 0) activate(index);
            }
        });
        select.addEventListener('change', sync);
        select.addEventListener('dropdown:sync', sync);
        new MutationObserver(sync).observe(select, { attributes: true, attributeFilter: ['disabled'] });
        sync();
    }

    document.addEventListener('DOMContentLoaded', () => document.querySelectorAll('select').forEach(enhance));
    document.addEventListener('pointerdown', event => {
        if (openDropdown && !openDropdown.trigger.contains(event.target) && !openDropdown.menu.contains(event.target)) openDropdown.close();
    });
    document.addEventListener('focusin', event => {
        if (openDropdown && !openDropdown.trigger.contains(event.target) && !openDropdown.menu.contains(event.target)) openDropdown.close();
    });
    window.addEventListener('resize', () => openDropdown?.position());
    document.addEventListener('scroll', event => {
        if (openDropdown && !openDropdown.menu.contains(event.target)) openDropdown.close();
    }, true);
})();
