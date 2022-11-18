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
		//if in combat don't do random encounter if not the gm don't do random encounter
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
				//check for compendium roll table
				var tableRoll = null;
				if (encounters[i].compendium != null) {
					let pack = await game.packs.get(encounters[i].compendium).getIndex()
					let tableData = await pack.getName(encounters[i].rolltable.split(" - ")[1])
					var tmp_table = await new RollTable(tableData)
					tableRoll = await tmp_table.roll()
				}
				else {
					tableRoll = await game.tables.find(t => t.name == encounters[i].rolltable).roll()
				}
				let tableResult = tableRoll.results[0]
				let text = tableResult.text
				console.log("message", tableResult.collection, tableResult.resultId, text)
				if (tableResult.resultId !== undefined) {
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

export class RandomEncounterCompendiumSettings extends FormApplication {
	constructor(object = {}, options) {
		super(object, options);
	}

	/** @override */
	static get defaultOptions() {
		return mergeObject(super.defaultOptions, {
			popOut: true,
			template: "modules/random-encounters/templates/compendiums.html",
			height: 'auto',
			id: 'random-encounters-compendiums',
			title: game.i18n.localize("RandomEncounter.compendium.name"),
			width: 700,
			popOut: true,
			minimizable: true,
            resizable: true,
			submitOnClose: true,
			closeOnSubmit: true,
		});
	}

	/** @override */
	async getData() {
		//get saved data
		let saved_compendiums = game.settings.get("random-encounters", "compendiums")
		let compendiums = []
		let sub = []
		let packs = game.packs.filter(a => a.metadata.type == "RollTable")	
		for (var i = 0; i < packs.length; i++) {
			sub.push({id:packs[i].metadata.id.replace(".", "_"), label:packs[i].metadata.label, checked: saved_compendiums.includes(packs[i].metadata.id)})
			if ((i + 1) % 3 == 0) {
				compendiums.push(sub)
				sub = []
			}
		}
		if (sub.length != 0) {
			compendiums.push(sub)
		}
		return {compendiums}
	}

	/** @override */
	async _updateObject(event, formData) {
		const data = expandObject(formData);
		let compendiums = []
		for (let [key, value] of Object.entries(data)) {
			if (value) {
				compendiums.push(key.replace("_", "."))
			}
		}
		await game.settings.set("random-encounters", "compendiums", compendiums);
		await this.render()
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
	async getData() {
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
			//get game tables
			game.tables.map(a => a.name).forEach(function(name) {
				encounters[i]["rolltables"].push({
					"name": name,
					"selected": name == encounters[i].rolltable,
					"compendium": null
				});
			});

			//get compendium tables if any are set
			let select_compendiums = game.settings.get("random-encounters", "compendiums")
			if (select_compendiums != null || select_compendiums != []) {
				//get selected rolltable packs
				let packs = game.packs.filter(a => a.metadata.type == "RollTable").filter(b => select_compendiums.includes(b.metadata.id))
				console.log(packs)
				for (var i = 0; i < packs.length; i++) {
					//load the pack data
					await packs[i].getIndex()
					//loop over the pack entries i.e. roll tables
					for(var [pack_key, value] of packs[i].index.entries()) {
						//get the table info and add it to the list
						let table = await packs[i].getDocument(value._id)
						let name = packs[i].metadata.label + " - " + table.name
						encounters[i]["rolltables"].push({
							"name": name,
							"selected": name == encounters[i].rolltable,
							"compendium": packs[i].metadata.id
						});
					}
				}
			}
		}
		return {encounters}
	}

	/** @override */
	async _updateObject(event, formData) {
		const data = expandObject(formData);
		let encounters = []
		for (let [key, value] of Object.entries(data)) {
			value.hidden = true
			if (value.name == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveNameError"));
				value.hidden = false
				return;
			}
			if (value.scene == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveSceneError"));
				value.hidden = false
				return;
			}
			if (value.rolltable == "") {
				ui.notifications.error(game.i18n.localize("RandomEncounter.SaveRollTableError"));
				value.hidden = false
				return;
			}
			//lookup compendium id and make sure its saved
			var t_arr = value.rolltable.split(",")
			value.rolltable = t_arr[0]
			if (t_arr[1] != "") {
				value.compendium = t_arr[1]
			}
			if(value.timeout_id != null && (value.timeout_id !== undefined || value.timeout_id != 0)) {
				value.timeout_id = parseInt(value.timeout_id);
				console.log(`random-encounters | unregister encounter ${value.timeout_id} with about-time`)
				await game.Gametime.clearTimeout(value.timeout_id)
				value.timeout_id = null
			}
			if (value.time != "" && value.time != null) {
				//make sure its a number
				if (!isNaN(value.time)) {
					console.log("random-encounters | register encounter with about-time")
					value.time = parseInt(value.time);
					let doEncounter = async (encounter) => {
						console.log("random-encounters | running from about-time", encounter)
						RandomEncounter.doRandomEncounters(encounter);
					}
					value.timeout_id = game.Gametime.doAtEvery({minute: value.time}, doEncounter, value)
				}
				else {
					ui.notifications.error(game.i18n.localize("RandomEncounter.TimeNaNError"));
					value.hidden = false
					return;
				}
			}
			encounters.push(value);
		}
		await game.settings.set("random-encounters", "encounters", encounters);
		await this.render()
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
			"time": null,
			"daynight": "",
			"chance": "",
			"onresult": "",
			"timeout_id": null,
			"rolltable": "",
			"compendium": null
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
		if(rmEncounter.timeout_id !== undefined || rmEncounter.timeout_id != 0) {
			await game.Gametime.clearTimeout(rmEncounter.timeout_id)
		}
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
	game.settings.registerMenu("random-encounters", "compendium-template", {
		name: "RandomEncounter.compendium.name",
		label: "RandomEncounter.compendium.label",
		hint: "RandomEncounter.compendium.hint",
		type: RandomEncounterCompendiumSettings,
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
	game.settings.register("random-encounters", "compendiums", {
		name: "",
		hint: "",
		scope: "world",
		config: false,
		default: ["None"],
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