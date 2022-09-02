export default class RandomEncounter {
	static printMessage(title, message){
		let chatData = {
			user : game.user.id,
			content : "<h2>Random Encounter for " + title + "</h2>" + message,
			whisper : game.users.contents.filter(u => u.isGM).map(u => u.id)
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
				game.togglePause(true, true)
			}
			//play random encounter sound effect
			message += result;
		}
		RandomEncounter.printMessage(title, message);
	}
	
	static checkRooms(tokens, scene, rooms) {
		//math taken from https://github.com/grandseiken/foundryvtt-multilevel-tokens/blob/master/multilevel.js
		console.debug("random-encounters | checking if tokens", tokens, "are in rooms", rooms)
		//if no tokens/scene/room is defined then just return
		if (rooms == "" || tokens.length == 0) {
			return false;
		}

		let room_arr = rooms.split(",")
		for (var r = 0; r < room_arr.length; r++) {
			let room = scene.drawings.find(a => a.text == room_arr[r]);
			if (room) {
				console.debug("random-encounters | checking room", room)
				// loop over tokens
				for(var j = 0; j < tokens.length; j++) {
					console.debug("random-encounters | checking token", tokens[j])
					//get token center
					let point = {
						x: tokens[j].x + tokens[j].width  / 2,
						y: tokens[j].y + tokens[j].height / 2
					}
					//check for image rotation and fix token points to match
					if (room.rotation) {
						//get drawing center
						const r = -room.rotation * Math.PI / 180;
						const center = {
							x: room.x + room.shape.width / 2, 
							y: room.y + room.shape.height / 2
						}
						point = {
							x: center.x + (point.x - center.x) * Math.cos(r) - (point.y - center.y) * Math.sin(r),
							y: center.y + (point.x - center.x) * Math.sin(r) + (point.y - center.y) * Math.cos(r)
						}
					}
					const shape = room.shape
					//check if token is within the drawing box
					const inBox = point.x >= room.x && point.x <= room.x + room.shape.width && point.y >= room.y && point.y <= room.y + room.shape.height;
					if (!inBox) {
						return false
					}
					//if its a rectangle then we good
					if (shape.type === CONST.DRAWING_TYPES.RECTANGLE) {
						return true;
					}
					//make sure token is within the ellipse
					if (shape.type === CONST.DRAWING_TYPES.ELLIPSE) {
						if (!shape.width || !shape.height) {
							return false
						}
						const dx = room.x + shape.width / 2 - point.x;
						const dy = room.y + shape.height / 2 - point.y;
						let in_ellipse = 4 * (dx * dx) / (shape.width * shape.width) + 4 * (dy * dy) / (shape.height * shape.height) <= 1;
						if (in_ellipse) {
							return true;
						}
					}
					//check if token is within any of the points
					if (shape.type === CONST.DRAWING_TYPES.POLYGON) {
						const x = point.x - room.x;
						const y = point.y - room.y;
						let vs = []
						for (let i = 0; i < shape.points.length; i += 2) {
							vs.push([shape.points[i],shape.points[i+1]])							
						}
						var inside = false;
						for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
							var xi = vs[i][0]
							var yi = vs[i][1]
							var xj = vs[j][0]
							var yj = vs[j][1]
							var intersects = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
							if (intersects)
								inside = !inside
						}
						return inside
					}
				}
			}
		}
		//if gotten this far no room matched so return false;
		return false;
	}
	
	static async doRandomEncounters(encounter = null) {
		//if in combat dont do random encounter if not the gm dont do random encounter
		if (game.combat || !game.users.filter(a => a.id == game.userId)[0].isGM) {
			return false;
		}
		//get active scene
		let scene = game.scenes.find(a => a.active);
		console.log(`random-encounters | checking if scene '${scene.name}' has encounters`)
		//get possible encounters based on scene, day/night/none options
		let dayNight = scene.darkness == 0 ? "Day" : "Night"
		//get pc tokens
		let pc_tokens = scene.tokens.filter(a => !a.isNPC)
		let encounters = []
		if (encounter) {
			console.debug("random-encounters | encounter was passed in checking conditions")
			if (encounter.scene == scene.name && (encounter.daynight == dayNight || encounter.daynight == "None")) {
				//if encounter is for a room
				if (encounter.rooms != "") {
					if (RandomEncounter.checkRooms(pc_tokens, scene, encounter.rooms)) {
						console.debug("random-encounters | encounter for room and pcs are in room")
						encounters.push(encounter)
					}
				}
				else {
					console.debug("random-encounters | checking for other room encounters and if pcs are in room")
					//check if scene has rooms and if pcs are in the room
					let rm_encounters = game.settings.get("random-encounters", "encounters")
						.filter(a => a.scene ==  scene.name)
						.filter(a => a.daynight == dayNight || a.daynight == "None")
						.filter(a => a.rooms != "")
						.filter(a => RandomEncounter.checkRooms(pc_tokens, scene, a.rooms))
					if (rm_encounters.length == 0) {
						encounters.push(encounter)
					}
				}
			}
		}
		else {
			console.debug(`random-encounters | checking for room encounters`)
			encounters = game.settings.get("random-encounters", "encounters")
				.filter(a => a.scene ==  scene.name)
				.filter(a => a.daynight == dayNight || a.daynight == "None")
				.filter(a => a.rooms != "")
				.filter(a => RandomEncounter.checkRooms(pc_tokens, scene, a.rooms))
			
			if (encounters.length == 0) {
				console.debug(`random-encounters | no room encounters checking for scene encounters`)
				encounters = game.settings.get("random-encounters", "encounters")
					.filter(a => a.scene ==  scene.name)
					.filter(a => a.daynight == dayNight || a.daynight == "None")
					.filter(a => a.rooms == "")
			}
		}
		//do encounter
		for(var i = 0; i < encounters.length; i++) {
			//Theres a random encounter run it
			console.log("random-encounters | checking for random encounter")
			let doRollTable = false;
			//do roll check if one is set
			if(encounters[i].chance == "") {
				doRollTable = true;
			}
			else {
				console.debug("random-encounters | roll for chance encounter")
				//do roll
				var roll = new Roll(encounters[i].chance, {}).evaluate({"async":false}).total;
				//check for range
				if(encounters[i].onresult.includes("-")) {
					var range = encounters[i].onresult.split("-");
					//if roll is within range do table
					if(roll >= parseInt(range[0]) && roll <= parseInt(range[1])) {
						doRollTable = true;
					}
				}
				//check roll against value
				else {
					if(roll == parseInt(encounters[i].onresult)) {
						doRollTable = true;
					}
				}
			}
			if(doRollTable) {
				console.log(`random-encounters | random encounter '${encounters[i].name}' has been triggered`)
				let tableRoll = await game.tables.find(t => t.name == encounters[i].rolltable).roll()
				let tableResult = tableRoll.results[0]
				let text = tableResult.text
				if (tableResult.collection) {
					text = "@Compendium[" + tableResult.collection + "." + tableResult.resultId + "]{" + text + "}"
				}
				RandomEncounter.printEncounter(encounters[i].name, text);
			}
			else {
				RandomEncounter.printMessage(encounters[i].name, "No Random Encounter");
			}
		}
	}
}

export class RandomEncounterSettings extends FormApplication {
	constructor(object = {}, options) {
		super(object, options);
	}

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			popOut: true,
			template: "modules/random-encounters/templates/encounters.html",
			height: 'auto',
			id: 'random-encounters',
			title: game.i18n.localize("RandomEncounter.button.name"),
			width: 700,
			popOut: true,
			minimizable: true,
            resizable: true,
			submitOnClose: false,
			closeOnSubmit: false,
		});
	}

	/** @override */
	getData() {
		let encounters = game.settings.get("random-encounters", "encounters");
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
			encounters[i]["daynight_options"] = [{"name": "None", "selected": false}, {"name": "Day", "selected": false}, {"name": "Night", "selected": false}]
			for(var j = 0; j < encounters[i]["daynight_options"].length; j++) {
				if(encounters[i]["daynight_options"][j]["name"] == encounters[i].daynight) {
					encounters[i]["daynight_options"][j]["selected"] = true;
				}
			}
			
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
		let errors = false;
		for (let [key, value] of Object.entries(data)) {
			value.hidden = true
			if (value.name == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveNameError"));
				errors = true;
				value.hidden = false
				continue;
			}
			if (value.scene == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveSceneError"));
				errors = true;
				value.hidden = false
				continue;
			}
			if (value.rolltable == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveRollTableError"));
				errors = true;
				value.hidden = false
				continue;
			}
			value.time = parseInt(value.time);
			encounters.push(value);
		}
		if (!errors) {
			console.debug("random-encounters | saving new encounter")
			await game.settings.set("random-encounters", "encounters", encounters);
			if (game.modules.get("about-time")?.active) {
				if(!game.Gametime.isRunning()) {
					game.Gametime.startRunning();
				}
				let encounters = game.settings.get("random-encounters", "encounters")
				for (var i = 0; i < encounters.length; i++) { 
					if(encounters[i].timeout_id != "") {
						console.log("random-encounters | unregister encounter with about-time")
						game.Gametime.clearTimeout(encounters[i].timeout_id)
					}
					console.log("random-encounters | register encounter with about-time")
					let doEncounter = async (encounter) => {
						console.log("random-encounters | running from about-time", encounter)
						RandomEncounter.doRandomEncounters(encounter);
					}
					encounters[i].timeout_id = game.Gametime.doEvery({minutes: encounters[i].time}, doEncounter, encounters[i])
				}
				game.settings.set("random-encounters", "encounters", encounters)
				game.Gametime._save();
			}
			await this.render()
		}
	}

	/** @override */
	activateListeners(html) {
		super.activateListeners(html);
		html.find('.add-encounter').click(this._onAddEncounter.bind(this));
		html.find('.remove-encounter').click(this._onRemoveEncounter.bind(this));
		html.find('.collapse-button').click(this._expandEncounter.bind(this));
	}

	async _onAddEncounter(event) {
		event.preventDefault();
		let encounters = game.settings.get("random-encounters", "encounters");
		let updateData = {
			"hidden": true,
			"name": "",
			"scene": "",
			"rooms": "",
			"time": "",
			"daynight": "",
			"chance": "",
			"onresult": "",
			"rolltable": "",
			"timeout_id": ""
		}
		encounters.push(updateData);
		await game.settings.set("random-encounters", "encounters", encounters)
		this.render();
	}

	async _onRemoveEncounter(event) {
		event.preventDefault();
		const el = $(event.target);
		if (!el) {
			return true;
		}
		let encounters = game.settings.get("random-encounters", "encounters");
		let rmEncounter = encounters[el.data("idx")]
		game.Gametime.clearTimeout(rmEncounter.timeout_id)
		game.Gametime._save();
		encounters.splice(el.data("idx"), 1);
		await game.settings.set("random-encounters", "encounters", encounters)
		el.remove();
		this.render();
	}

	async _expandEncounter(event) {
		event.preventDefault();
		const el = $(event.target)
		if (!el) {
			console.warn("no element matches button")
			return true
		}
		let encounters = game.settings.get("random-encounters", "encounters");
		const target = $(el.data("id"))
		if(el.hasClass("active")) {
			target.hide()
			el.removeClass("active fa-minus").addClass("fa-plus")
			encounters[el.data("idx")].hidden = true
		}
		else {
			target.show()
			el.removeClass("active fa-plus").addClass("active fa-minus")
			encounters[el.data("idx")].hidden = false
		}
		//save render state
		await game.settings.set("random-encounters", "encounters", encounters)
		this.render()
	}
}

Hooks.on("init", () => {
	console.debug("random-encounters | register keybind settings")
	game.keybindings.register("random-encounters", "key", {
		name: "QuickCombat.Keybind",
		hint: "QuickCombat.KeybindHint",
		editable: [
			{
				key: "R",
				modifiers: ["Alt"]
			}
		],
		onDown: () => {
			console.debug("random-encounters | hotkey pressed")
			RandomEncounter.doRandomEncounters();
		},
		restricted: true,
		precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
	});
});

Hooks.on("ready", function () {
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;
	//check for old settings and migrate
	//some issues with the new version in that it was not migrating old settings when I fixed the name
	console.debug("random-encounters | register settings")
	game.settings.registerMenu("random-encounters", "template", {
		name: "RandomEncounter.button.name",
		label: "RandomEncounter.button.label",
		hint: "RandomEncounter.button.hint",
		type: RandomEncounterSettings,
		restricted: true
	});
	game.settings.register("random-encounters", "encounters", {
		name: "",
		hint: "",
		scope: "world",
		config: false,
		default: [],
		type: Object
	});
	console.debug("random-encounters | checking for old settings")
	var old_settings = []
	game.settings.settings.forEach(a => {
		if (a.module == "random-encounter") {
			old_settings.push(a)
		}
	})
	if (old_settings.length != 0) {
		Dialog.confirm({
			title: "Random Encounters Settings Migration",
			content: "<p>Found old Random Encounter settings do you want to keep the old settings?</p><p><strong>Yes</strong> will migrate and delete the old settings</p><p><strong>No</strong> will delete the old settings.</p>",
			yes: () => {
				for(var i = 0; i < old_settings.length; i++) {
					game.settings.set("random-encounters", old_settings[i].key, old_settings[i].default);
				}
				game.settings.settings.forEach((v, k, m) => {
					if (v.module == "random-encounter") {
						console.log(`random-encounters | deleting old setting ${k}`)
						game.settings.settings.delete(k)
					}
				})
			},
			no: () => {
				game.settings.settings.forEach((v, k, m) => {
					if (v.module == "random-encounter") {
						console.log(`random-encounters | deleting old setting ${k}`)
						game.settings.settings.delete(k)
					}
				})
			},
			defaultYes: true	
		})
	}
});

Hooks.once("setup", function() {
	console.debug("random-encounters | running setup hooks")
	var operations = {
		doRandomEncounters: RandomEncounter.doRandomEncounters,
	}
	game.RandomEncounters = operations;
	window.RandomEncounters = operations;
})