var map;
var clickedLocation;
function add(){
    let huntname = document.getElementById('huntname').value;
    console.log(huntname);
    huntnames = huntnames.split(',');
    for (let i=0;i<huntnames.length;i++){
        if(huntnames[i] == huntname){
            alert("Hunt name already exists");
            document.getElementById('huntname').value = '';
            return;
        }
    }

    let n_clues = document.getElementById('n_clues').value;

    if(n_clues<1){
        alert("Number of clues should be greater than 0");
        // document.getElementById('huntname').value = '';
        document.getElementById('n_clues').value = '';
        return;
    }

    let container = document.getElementById('input-container');
    let form = document.getElementById('form');
    form.style.height = "30rem";  
    let signin = document.getElementById('signin');
    signin.style.height = "40rem";  

    container.innerHTML = ''; // Clear the container
    let text = "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < n_clues; i++) {
        let input1 = document.createElement('input');
        input1.className = 'clue';
        input1.placeholder = 'Clue ' + (i + 1);
        input1.type = 'text';
        input1.name = 'Clue';
        input1.required = true;
        container.appendChild(input1);
        let input2 = document.createElement('input');
        input2.className = 'location';
        input2.placeholder = 'Location ' + (i + 1);
        input2.type = 'text';
        input2.name = 'Location';
        input1.required = true;
        container.appendChild(input2);
        let input3 = document.createElement('input');
        input3.className = 'hint';
        input3.type = 'text';
        input3.placeholder = 'Hint ' + (i + 1);
        input3.name ='Hint' ;
        input1.required = true;
        container.appendChild(input3);
        let button = document.createElement('div'); 
        button.className = 'dom-btn'; // Apply the same styling class as clues and hints
        button.textContent = 'Select Location ' + (i + 1);
        button.addEventListener('click', function () {
            document.getElementById('map').style.zIndex = 10000;
            openMap().then(clickedLocation => {
                console.log('Clicked location: ' + clickedLocation.lat + ', ' + clickedLocation.lng);
                input2.value = clickedLocation.lat.toFixed(12) + ', ' + clickedLocation.lng.toFixed(12);
            });
        });
        container.appendChild(button);
    }
    let btn = document.createElement("button");
    btn.innerHTML = "Save";
    container.appendChild(btn);
    btn.className = "dom-btn";

    // let div = document.createElement('div'); // Create a div element
    // div.className = 'signin'; 
    // div.appendChild(); // Append the input to the div

    document.getElementById('enter_btn').style.display = 'none';
}



        
function openMap() {
    return new Promise((resolve, reject) => {
        document.getElementById('map').style.display = 'block';
        if (!map) {
            map = L.map('map').setView([29.86499676312487, 77.89658008904541], 18);
        }

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', function (e) {
            clickedLocation = e.latlng;
            document.getElementById('map').style.display = 'none'; // Hide the map
            resolve(clickedLocation); // Resolve the Promise with the clicked location
        });
    });
}
        function useClickedLocation() {
            if (clickedLocation) {
                // Use the clicked location here
                console.log('Using clicked location: ' + clickedLocation.lat + ', ' + clickedLocation.lng);
                return clickedLocation;
            }
        }