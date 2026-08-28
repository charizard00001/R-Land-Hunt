

const ws = new WebSocket('ws://localhost:3000');

let hunt_to_start = hunt_to_strt;
// dont consider this error the line will work because i have defined this varibale in hun2.ejs script tag
 
console.log(hunt_to_start);

//send a message to server
ws.addEventListener('open', () => {
    let data = ['Serve', hunt_to_start];
    ws.send(JSON.stringify(data));
    
});

ws.addEventListener('message', (event) => {
    console.log('Received: ', event.data);
    let message = event.data;

    try {
        message = JSON.parse(message);
        console.log(message[0]);
        console.log('parsed')
    } catch (e) {
        console.log('not json');
    }

    if(message === 'giveScoresToAdmin'){
        console.log('requesting scores for admin');
        let data = ['AdminScore', 0,'admin'];
        ws.send(JSON.stringify(data));
        console.log('score sent to admin');
    }

    if (message === 'giveScores'){
        console.log('requesting scores');
        let data = ['Score', 0,'admin'];
        ws.send(JSON.stringify(data));
        console.log('score sent');
    }
    if(message[0] === 'Adminscores'){
        console.log('scores received');
        console.log(message[1]);
        Adminscores = message[1];
        showLeaderboard();
        
    }
});


function showLeaderboard(){
    
    
    let oldTable = document.getElementById('leaderboardTable');
    if (oldTable) oldTable.remove();

    let table = document.createElement('table');
    table.setAttribute('id', 'leaderboardTable');
    table.style.width = '90%'; 
    table.style.borderCollapse = 'collapse'; 
    table.style.marginLeft = '2rem'; 
    table.style.backgroundColor = '#f8f8f8'; 

    let insLeaderboard = document.getElementById("insLeaderboard");

    let row = document.createElement('tr');
    let teamCell = document.createElement('th');
    teamCell.textContent = 'Team';
    teamCell.style.border = '1px solid black';
    teamCell.style.padding = '10px';
    teamCell.style.color = '#333';
    row.appendChild(teamCell);

    let scoreCell = document.createElement('th');
    scoreCell.textContent = 'Score';
    scoreCell.style.border = '1px solid black';
    scoreCell.style.padding = '10px';
    scoreCell.style.color = '#333';
    row.appendChild(scoreCell);
    
    table.appendChild(row);
    for (let i = 0; i < Adminscores.length; i++) {
        let row = document.createElement('tr');

        let teamCell = document.createElement('td');
        teamCell.textContent = Adminscores[i][1]; 
        teamCell.style.border = '1px solid black'; 
        teamCell.style.padding = '10px'; 
        teamCell.style.color = '#333'; 
        row.appendChild(teamCell);

        let scoreCell = document.createElement('td');
        scoreCell.textContent = Adminscores[i][0]; // score
        scoreCell.style.border = '1px solid black';
        scoreCell.style.padding = '10px'; 
        scoreCell.style.color = '#333';
        row.appendChild(scoreCell);

        table.appendChild(row);
    }


    insLeaderboard.appendChild(table);
}

const id = setInterval(() => {
    ws.send('requestLeaderboardForAdmin');
},5000);


function endHunt(){
    isTimerRunning = true;
    ws.send('endHunt');
    toggleTimer();
    let pauser = document.getElementById('pauser');
    pauser.remove();
    let cnt = document.getElementById('countdown');
    cnt.innerHTML = 'Hunt Ended';
    let ender = document.getElementById('ender');
    ender.remove();
    clearInterval(id);

    const data= {
        huntname: hunt_to_start
        
    }
    fetch('/rm_strtd_hunt_data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    
}


function pauser() {
    // let button = document.querySelector('button');
    let button = document.getElementById('pauser');
    if (button.innerText == "Start Timer") {
        ws.send('pause');
    } else {
        ws.send('resume');
    }
}




//ebSocket is already in CLOSING or CLOSED state.