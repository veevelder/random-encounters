//set to do every 10 minutes
//game.Gametime.doEvery({minutes:10}, "Random Encounters")
let message = "The party has come across an <b>Encounter</b> ";

function printMessage(message){
	let chatData = {
		user : game.user._id,
		content : "<h2>Random Encounter</h2>" + message,
		whisper : game.users.entities.filter(u => u.isGM).map(u => u._id)
	};
	ChatMessage.create(chatData,{});
}

function printEncounter(result){
	if (result.text == "None"){
		message = "No random encounter";
	} else {
		//pause game if not already paused
		if(!game.paused) {
			game.togglePause()
		}
		//play random encounter sound effect
		message += result.text;
	}
	printMessage(message);
}


let dessarin_valley = new Dialog({
	title: "Check for Random Encounter",
	content: "Where to check for <b>Random Encounter</b>? During chapters 3 and 4 use the \"Early Travels\" random encounter table. During chapter 5 use the \"Later Travels\" table. At any point during travel on or very near the Dessarin River, use the \"River Travels\" table.",
	buttons:{
		early:{
			label: "Early Travels",
			callback: () => {
				message += "in the <b>Early Travels</b> ";
				if(game.scenes.active.data.darkness == 0) {
					message += "during the <b>Daytime</b>. ";
					//day time
					printEncounter(game.tables.entities.find(t => t.name === "DV-Early-Travels-Day").roll().results[0]);
				}
				else {
					message += "during the <b>Nighttime</b>. ";
					//night time
					printEncounter(game.tables.entities.find(t => t.name === "DV-Early-Travels-Night").roll().results[0]);
				}
			}
		},
		river:{
			label: "River Travels",
			callback: () => {
				message += "on the <b>River</b> ";
				printEncounter(game.tables.entities.find(t => t.name === "DV-River-Travels").roll().results[0]);
			}
		},
		later:{
			label: "Later Travels",
			callback: () => {
				message += "in the <b>Later Travels</b> ";
				if(game.scenes.active.data.darkness == 0) {
					message += "during the <b>Daytime</b>. ";
					//day time
					printEncounter(game.tables.entities.find(t => t.name === "DV-Later-Travels-Day").roll().results[0]);
				}
				else {
					message += "during the <b>Nighttime</b>. ";
					//night time
					printEncounter(game.tables.entities.find(t => t.name === "DV-Later-Travels-Night").roll().results[0]);
				}
			}
		}
	}
})

let weeping_colossus = new Dialog({
	title: "Check for Random Encounter",
	content: "For every 30 minutes the characters spend inside the Weeping Colossus, roll a d20 and consult the following table. In the medium intensity zone, roll a d20 and a d4, subtracting the d4 from the d20 roll. Use a d6 instead of a d4 in the high intensity zone.",
	buttons:{
		medium:{
			label: "Medium Heat Zone",
			callback: () => {
				message += "in the <b>Medium Heat Zone</b> ";
				printEncounter(game.tables.entities.find(t => t.name === "WC-MediumHeat-Random-Encounters").roll().results[0]);
			}
		},
		high:{
			label: "High Heat Zone",
			callback: () => {
				message += "in the <b>High Heat Zone</b> ";
				printEncounter(game.tables.entities.find(t => t.name === "WC-HighHeat-Random-Encounters").roll().results[0]);
			}
		},
		none:{
			label: "No Zone",
			callback: () => {
				message += "in <b>No Zone</b> ";
				printEncounter(game.tables.entities.find(t => t.name === "WC-Random-Encounters").roll().results[0]);
			}
		}
	}
})

async function checkRoom(pcs, x, y, w, h, table) {
	for (var i = 0; i < pcs.length; i++) {
		let t = await pcs[i].getActiveTokens()
		for(var j = 0; j < t.length; j++) {
			if((t[j].x >= x && t[j].x <= w) && (t[j].y >= y && t[j].y <= h)) {
				printEncounter(game.tables.entities.find(t => t.name === table).roll().results[0])
				return
			}
		}
	}
}

let pcs = game.actors.filter(a => a.isPC)

if (new Roll("1d12", {}).roll().total == 1) {
    printEncounter(game.tables.entities.find(t => t.name === "Random Encounters").roll().results[0])
}
else {
    printMessage("No random encounter");
}