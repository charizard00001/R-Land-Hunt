const ws = new WebSocket('ws://localhost:3000');





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
        adminScoreProvider();
    }

    if (message[0] === 'startedAdminPages'){
        console.log('admin pages started');
        if(message[1] === myHuntname){
            console.log('admin pages started for this hunt');
            show();
        }
    }

    if(message === 'endHunt'){
        console.log('ending hunt');
        endHunt();
    }

    if(message[0] === 'scores'){
        console.log('scores received');
        console.log(message[1]);
        scores = message[1];
        showLeaderboard();
        
    }

    if (message === 'stoppedAdminPages'){
        console.log('admin pages stopped');
        dontshow();
    }

    if (message === 'giveScores'){
        console.log('requesting scores');
        scoreProvider();
    }

    if(message === 'resume'){
        isCompleted = false;
        alert('The hunt has been resumed by the organiser!');
        let locationChecker = document.getElementById("locationChecker");
        locationChecker.style.display = "block";
    }

    if(message === 'pause'){
        isCompleted = true;
        alert('The hunt has been paused by the organiser!');
        let locationChecker = document.getElementById("locationChecker");
        locationChecker.style.display = "none";

    }
});


function show(){
    let center = document.getElementById("center");
    center.style.display = "block";

    let center2 =  document.getElementById("center2");
    center2.style.display = "none";
}

function dontshow(){
    let center = document.getElementById("center");
    center.style.display = "none";

    let center2 =  document.getElementById("center2");
    center2.style.display = "block";
}

function requestLeaderboard(){
    ws.send('requestLeaderboard');
    
}

function refreshPage(){
    ws.send('requestLeaderboard');
}



function scoreProvider(){
    let data = ['Score', score, teamname];
    ws.send(JSON.stringify(data));
    console.log('score sent');
}

function adminScoreProvider(){
    let data = ['AdminScore', score, teamname];
    ws.send(JSON.stringify(data));
    console.log('score sent to admin');
}

function showLeaderboard(){
    
    
    let oldTable = document.getElementById('leaderboardTable');
    if (oldTable) oldTable.remove();

    let table = document.createElement('table');
    table.setAttribute('id', 'leaderboardTable');
    table.style.width = '90%'; 
    table.style.borderCollapse = 'collapse'; 
    table.style.margin = '3rem 1.5rem'; 
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
    for (let i = 0; i < scores.length; i++) {
        let row = document.createElement('tr');

        let teamCell = document.createElement('td');
        teamCell.textContent = scores[i][1]; 
        teamCell.style.border = '1px solid black'; 
        teamCell.style.padding = '10px'; 
        teamCell.style.color = '#333'; 
        row.appendChild(teamCell);

        let scoreCell = document.createElement('td');
        scoreCell.textContent = scores[i][0]; // score
        scoreCell.style.border = '1px solid black';
        scoreCell.style.padding = '10px'; 
        scoreCell.style.color = '#333';
        row.appendChild(scoreCell);

        table.appendChild(row);
    }


    insLeaderboard.appendChild(table);
}

function closePopup(){
    let top = document.getElementById("top");
    let bottom = document.getElementById("bottom");
    let form = document.getElementById("form");
    let center_buttons = document.getElementById("center_buttons");
    let leaderboard = document.getElementById("leaderboard");
    // let table = document.getElementById("leaderboardTable");

    top.style.display = "flex";
    bottom.style.display = "block";
    form.style.display = "block";
    if(isCompleted == false && center_buttons.style.display == "none"){
        center_buttons.style.display = "block";
    }
    
    leaderboard.style.display = "none";
    // table.style.display = "none";
    


}



function endHunt(){
    isCompleted = true;
    dontshow();
    let center2 = document.getElementById("center2");
    center2.innerHTML = " The hunt has been ended! ";

}

// Call showLeaderboard every 3 seconds
// setInterval(showLeaderboard, 3000);

