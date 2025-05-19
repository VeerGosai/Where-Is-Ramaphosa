document.addEventListener('DOMContentLoaded', function() {
    // Set current year in the footer
    document.getElementById('current-year').textContent = new Date().getFullYear();
    
    // Fetch the data from data.json
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            displayData(data);
            updateCurrentLocation(data);
            initializeMap(data);
        })
        .catch(error => {
            console.error('There was a problem fetching the data:', error);
            displayError();
        });
});

function updateCurrentLocation(data) {
    const locationStatusElement = document.getElementById('current-location-status');
    const locationIconElement = document.getElementById('location-icon-symbol');
    const locationFlagElement = document.getElementById('location-flag');
    const locationCard = document.querySelector('.location-card');
    
    // Check if destination indicates in transit ("— —")
    if (data.destination === "— —") {
        locationStatusElement.textContent = "In Transit";
        locationIconElement.textContent = "✈️";
        locationFlagElement.textContent = "🛫"; // Departure symbol instead of flag
        locationCard.classList.add('in-transit');
        locationCard.classList.remove('at-location');
    } else {
        locationStatusElement.textContent = data.destination;
        locationIconElement.textContent = "📍";
        
        // Set appropriate flag based on location (default to South Africa)
        // This could be extended to show different flags for international travel
        if (data.destination.includes("South Africa")) {
            locationFlagElement.textContent = "🇿🇦";  // South Africa flag
        } else if (data.destination.includes("Kenya")) {
            locationFlagElement.textContent = "🇰🇪";  // Kenya flag
        } else if (data.destination.includes("Nigeria")) {
            locationFlagElement.textContent = "🇳🇬";  // Nigeria flag
        } else {
            locationFlagElement.textContent = "🇿🇦";  // Default to South Africa flag
        }
        
        locationCard.classList.add('at-location');
        locationCard.classList.remove('in-transit');
    }
    
    // Add animation effect
    locationCard.classList.add('location-update');
    setTimeout(() => {
        locationCard.classList.remove('location-update');
    }, 1000);
}

function displayData(data) {
    // Update the DOM with the data
    document.getElementById('departing-location').textContent = data.departing;
    document.getElementById('destination-location').textContent = data.destination;
    document.getElementById('destination-date').textContent = data.destination_date;
    document.getElementById('destination-time').textContent = data.destination_time;
    
    // Add animation to elements as they update
    const elements = [
        'departing-location', 
        'destination-location',
        'destination-date',
        'destination-time'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        element.classList.add('updated');
        setTimeout(() => {
            element.classList.remove('updated');
        }, 1000);
    });
}

function displayError() {
    const errorMessage = 'Sorry, we could not load the latest data. Please try again later.';
    const elements = [
        'departing-location', 
        'destination-location',
        'destination-date',
        'destination-time'
    ];
    
    elements.forEach(id => {
        document.getElementById(id).textContent = errorMessage;
        document.getElementById(id).classList.add('error');
    });
}

function initializeMap(data) {
    // Create a map centered on South Africa
    const map = L.map('map').setView([-30.5595, 22.9375], 5);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Function to geocode a location name and add a marker
    function addLocationMarker(locationName, isDestination = false) {
        // Using Nominatim geocoding service
        const encodedLocation = encodeURIComponent(locationName);
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    
                    // Create marker with custom icon and popup
                    const markerIcon = L.divIcon({
                        className: isDestination ? 'destination-marker' : 'departure-marker',
                        html: `<div class="marker-pin ${isDestination ? 'destination' : 'departure'}"></div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    });
                    
                    const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
                    marker.bindPopup(`<b>${locationName}</b><br>${isDestination ? 'Destination' : 'Departure'}`).openPopup();
                    
                    // Draw a line between departure and destination if both markers exist
                    if (map.departureCoords && isDestination) {
                        const polyline = L.polyline([map.departureCoords, [lat, lon]], {
                            color: '#007bff',
                            weight: 3,
                            opacity: 0.7,
                            dashArray: '10, 10'
                        }).addTo(map);
                        
                        // Animate the line
                        const animatedPolyline = L.polyline([[map.departureCoords[0], map.departureCoords[1]]], {
                            color: '#ff4757',
                            weight: 4
                        }).addTo(map);
                        
                        animateLine(animatedPolyline, map.departureCoords, [lat, lon]);
                        
                        // Set map view to show both markers
                        map.fitBounds([
                            map.departureCoords,
                            [lat, lon]
                        ], { padding: [50, 50] });
                    }
                    
                    // Store departure coordinates for later use
                    if (!isDestination) {
                        map.departureCoords = [lat, lon];
                    }
                }
            })
            .catch(error => {
                console.error('Error geocoding location:', error);
            });
    }
    
    // Animate a line from start to end point
    function animateLine(line, startPoint, endPoint) {
        const startLat = startPoint[0];
        const startLng = startPoint[1];
        const endLat = endPoint[0];
        const endLng = endPoint[1];
        
        let i = 0;
        const numSteps = 100;
        
        const interval = setInterval(() => {
            i++;
            const lat = startLat + (endLat - startLat) * i / numSteps;
            const lng = startLng + (endLng - startLng) * i / numSteps;
            
            line.addLatLng([lat, lng]);
            
            if (i === numSteps) {
                clearInterval(interval);
            }
        }, 20);
    }
    
    // Add markers for departure and destination
    addLocationMarker(data.departing, false);
    addLocationMarker(data.destination, true);
    
    // Add CSS for the map markers
    const style = document.createElement('style');
    style.textContent = `
        .marker-pin {
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            background: #c30b82;
            transform: rotate(-45deg);
            position: relative;
        }
        .marker-pin.departure {
            background: #4caf50;
        }
        .marker-pin.destination {
            background: #007bff;
        }
        .marker-pin:after {
            content: '';
            width: 14px;
            height: 14px;
            background: #fff;
            position: absolute;
            border-radius: 50%;
            top: 8px;
            left: 8px;
        }
    `;
    document.head.appendChild(style);
}
