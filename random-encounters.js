export class RandomEncounterSettings extends FormApplication {
	static init() {
		game.settings.registerMenu("random-encounter", "template", {
			name: "RandomEncounter.button.name",
			label: "RandomEncounter.button.label",
			hint: "RandomEncounter.button.hint",
			type: RandomEncounterSettings,
			restricted: true
		});
		
		game.settings.register("random-encounter", "encounters", {
			name: "",
			hint: "",
			scope: "world",
			config: false,
			default: [],
			type: Object
		});

		game.settings.register("random-encounter", "key", {
			name: "RandomEncounter.Keybind",
			hint: "RandomEncounter.KeybindHint",
			scope: "world",
			config: true,
			default: "",
			type: String
		});
	};
	
	/** @override */
	static get defaultOptions() {
		return {
			...super.defaultOptions,
			template: "modules/random-encounters/templates/encounter.html",
			height: 'auto',
			title: game.i18n.localize("RandomEncounter.button.name"),
			width: 600,
			classes: ["random-encounter", "settings"],
			submitOnClose: false,
		};
	}

	constructor(object = {}, options) {
		super(object, options);
	}

	/** @override */
	getData() {
		let encounters = game.settings.get("random-encounter", "encounters");
		for (var i = 0; i < encounters.length; i++) {
			encounters[i]["scenes"] = [];
			game.scenes.map(a => a.name).forEach(function(name) {
				let selected = false;
				if(name == encounters[i].scene) {
					selected = true;
				}
				encounters[i]["scenes"].push({
					"name": name,
					"selected": selected
				});
			});
			
			encounters[i]["rolltables"] = [];
			game.tables.map(a => a.name).forEach(function(name) {
				let selected = false;
				if (name == encounters[i].rolltable) {
					selected = true;
				}
				encounters[i]["rolltables"].push({
					"name": name,
					"selected": selected
				});
			});
		}
		return {encounters}
	}

	/** @override */
	async _updateObject(event, formData) {
		const data = expandObject(formData);
		let encounters = []
		for (let [key, value] of Object.entries(data)) {
			if (value.name == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveNameError"));
				continue;
			}
			if (value.scene == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveSceneError"));
				continue;
			}
			if (value.rolltable == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveRollTableError"));
				continue;
			}
			value.time = parseInt(value.time);
			encounters.push(value);
		}
		await game.settings.set("random-encounter", "encounters", encounters);
		RandomEncounter.registerRandomEncounters();
	}

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		html.find('button.add-encounter').click(this._onAddEncounter.bind(this));
		html.find('button.remove-encounter').click(this._onRemoveEncounter.bind(this));
		html.find('button.add-rolltable').click(this._createRollTable.bind(this));
	}

	async _onAddEncounter(event) {
		event.preventDefault();
		let encounters = game.settings.get("random-encounter", "encounters");
		let updateData = {
			"name": "",
			"scene": "",
			"time": "",
			"chance": "",
			"rolltable": "",
			"timeout_id": ""
		}
		encounters.push(updateData);
		await game.settings.set("random-encounter", "encounters", encounters)
		this.render();
	}

	async _onRemoveEncounter(event) {
		event.preventDefault();
		const el = $(event.target).closest(".encounter-entry");
		if (!el) {
			return true;
		}
		
		let encounters = game.settings.get("random-encounter", "encounters");
		
		let rmEncounter = encounters[el.data("idx")]
		game.Gametime.clearTimeout(rmEncounter.timeout_id)
		game.Gametime._save();
		encounters.splice(el.data("idx"), 1);
		game.settings.set("random-encounter", "encounters", encounters)
		el.remove();
		await this._onSubmit(event, { preventClose: true });
		this.render();
	}
	
	async _createRollTable(event) {
		event.preventDefault();
		$(event.target).closest("body").find("#tables button.create-entity").click()
	}
	
	//static do_render() {
	// rerender the window if it was open and if a new roll table was created 
	//	console.log("rendering");
	//	this.render();
	//}
}


let doEncounter = async (encounter) => {
	RandomEncounter.doRandomEncounter(encounter);
}

class RandomEncounter {
	static printMessage(title, message){
		let chatData = {
			user : game.user._id,
			content : "<h2>Random Encounter for " + title + "</h2>" + message,
			whisper : game.users.entities.filter(u => u.isGM).map(u => u._id)
		};
		ChatMessage.create(chatData,{});
	}

	static printEncounter(title, result){
		let message = "The party has come across an <b>Encounter</b> ";
		if (result == "None"){
			message = "No random encounter";
		} else {
			//pause game if not already paused
			if(!game.paused) {
				game.togglePause()
			}
			//play random encounter sound effect
			message += result;
		}
		RandomEncounter.printMessage(title, message);
	}
	
	static doRandomEncounters() {
		let active_scene = game.scenes.filter(a => a.active)[0].name;
		let encounters = game.settings.get("random-encounter", "encounters").filter(a => a.scene ==  active_scene);
		for(var i = 0; i < encounters.length; i++) {
			//do roll check if one is set
			let doRollTable = false;
			if(encounters[i].chance == "") {
				doRollTable = true;
			}
			else {
				if(new Roll(encounters[i].chance, {}).roll().total == 1) {
					doRollTable = true;
				}
			}

			if(doRollTable) {
				let tableResult = game.tables.entities.find(t => t.name == encounters[i].rolltable).roll().results[0]
				RandomEncounter.printEncounter(encounters[i].name, tableResult.text);
			}
			else {
				RandomEncounter.printMessage(encounters[i].name, "No Random Encounter");
			}
		}
	}
	
	static doRandomEncounter(encounter) {
		let active_scene = game.scenes.filter(a => a.active)[0].name;
		if (encounter.scene == active_scene) {
			//do roll check if one is set
			let doRollTable = false;
			if(encounter.chance == "") {
				doRollTable = true;
			}
			else {
				if(new Roll(encounter.chance, {}).roll().total == 1) {
					doRollTable = true;
				}
			}
			if(doRollTable) {
				let tableResult = game.tables.entities.find(t => t.name == encounter.rolltable).roll().results[0]
				RandomEncounter.printEncounter(encounter.name, tableResult.text);
			}
			else {
				RandomEncounter.printMessage(encounter.name, "No Random Encounter");
			}
		}
	}

	static checkAboutTime() {
		return game.modules.get("about-time")?.active;
	}
	
	static registerRandomEncounters() {
		if (RandomEncounter.checkAboutTime()) {
			if(!game.Gametime.isRunning()) {
				game.Gametime.startRunning();
			}
			let encounters = game.settings.get("random-encounter", "encounters")
			for (var i = 0; i < encounters.length; i++) {
				if(encounters[i].timeout_id != "") {
					game.Gametime.clearTimeout(encounters[i].timeout_id)
				}
				encounters[i].timeout_id = game.Gametime.doEvery({minutes: encounters[i].time}, doEncounter, encounters[i])
			}
			game.settings.set("random-encounter", "encounters", encounters)
			game.Gametime._save();
		}
	}
}

Hooks.once("ready", function() {
	window.addEventListener("keydown", ev => {
		if (ev.repeat || ev.target.type == "textarea" || ev.target.type == "select" || ev.target.type == "select")
			return true;

		if (game.settings.get("random-encounter", "key") != null) {
			if(game.settings.get("random-encounter", "key") == ev.key) {
				RandomEncounter.doRandomEncounters()
			}
		}
	});
});

Hooks.once("init", function () {
	RandomEncounterSettings.init();
});

//Hooks.on("createRollTable", function() {
	//refresh settings window so it can get the new roll table name
//	RandomEncounterSettings.do_render();
//});

