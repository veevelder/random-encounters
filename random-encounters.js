import {KeyBinding} from '../settings-extender/settings-extender.js'

export class RandomEncounter {
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
	
	static async checkRooms(scene, rooms) {
		//if no room is defined then just return
		if (rooms == "") {
			return true;
		}
		let room_arr = []
		if (rooms.includes(",")) {
			room_arr = rooms.split(",");
		}
		else {
			room_arr.push(rooms);
		}
		
		//get a list of pc tokens
		let pcs = game.actors.filter(a => a.hasPlayerOwner)
		console.debug("random-encounters | checking if actors", pcs, "are in rooms", rooms)
		for (var r = 0; r < room_arr.length; r++) {
			let room = scene.data.drawings.find(a => a.data.text == room_arr[r]);
			if (room) {
				room = room.data;
				// loop over the pcs
				for (var i = 0; i < pcs.length; i++) {
					//get any active tokens
					let tokens = await pcs[i].getActiveTokens()
					for(var j = 0; j < tokens.length; j++) {
						let point = {x: tokens[j].x, y: tokens[j].y};
						//check for image rotation and fix token points to match
						if (room.rotation) {
							const r = (-room.rotation) * Math.PI / 180;
							const center = {
								x: room.x + room.width / 2, 
								y: room.y + room.height / 2
							}
							point = {
								x: center.x + (point.x - center.x) * Math.cos(r) - (point.y - center.y) * Math.sin(r),
								y: center.y + (point.x - center.x) * Math.sin(r) + (point.y - center.y) * Math.cos(r)
							}
						}
						//check if token is within the drawing box
						const inBox = point.x >= room.x && point.x <= room.x + room.width && point.y >= room.y && point.y <= room.y + room.height;
						if (inBox) {
							//if its a rectangle then we good
							if (room.type === CONST.DRAWING_TYPES.RECTANGLE) {
								return true;
							}
							//make sure token is within the ellipse
							if (room.type === CONST.DRAWING_TYPES.ELLIPSE) {
								if (room.width && room.height) {
									const dx = room.x + room.width / 2 - point.x;
									const dy = room.y + room.height / 2 - point.y;
									let in_ellipse = 4 * (dx * dx) / (room.width * room.width) + 4 * (dy * dy) / (room.height * room.height) <= 1;
									if (in_ellipse) {
										return true;
									}
								}
							}
							//check if token is within any of the points
							if (room.type === CONST.DRAWING_TYPES.POLYGON) {
								const cx = point.x - room.x;
								const cy = point.y - room.y;
								let w = 0;
								for (let i0 = 0; i0 < room.points.length; ++i0) {
									let i1 = i0 + 1 === room.points.length ? 0 : i0 + 1;
									if (room.points[i0][1] <= cy && room.points[i1][1] > cy && (room.points[i1][0] - room.points[i0][0]) * (cy - room.points[i0][1]) - (room.points[i1][1] - room.points[i0][1]) * (cx - room.points[i0][0]) > 0) {
										++w;
									}
									if (room.points[i0][1] > cy && room.points[i1][1] <= cy && (room.points[i1][0] - room.points[i0][0]) * (cy - room.points[i0][1]) - (room.points[i1][1] - room.points[i0][1]) * (cx - room.points[i0][0]) < 0) {
										--w;
									}
								}
								if (w !== 0) {
									return true;
								}
							}	
						}
					}
				}
			}
		}
		
		//if gotten this far no room matched so return false;
		return false;
	}
	
	static doRandomEncounters() {
		//if in combat dont do random encounter if not the gm dont do random encounter
		if (game.combat || !game.users.filter(a => a.id == game.userId)[0].isGM) {
			return false;
		}

		let active_scene = game.scenes.find(a => a.active).name;
		console.log(`random-encounters | checking if scene '${active_scene}' has encounters`)
		let encounters = game.settings.get("random-encounters", "encounters").filter(a => a.scene ==  active_scene);
		for(var i = 0; i < encounters.length; i++) {
			RandomEncounter.doRandomEncounter(encounters[i])
		}
	}
	
	static async doRandomEncounter(encounter) {
		//if in combat dont do random encounter if not the gm dont do random encounter
		if (game.combat || !game.users.filter(a => a.id == game.userId)[0].isGM) {
			return false;
		}
		console.log("random-encounters | checking for random encounter")

		let scene = game.scenes.find(a => a.active);
		let doRollTable = false;
		if (encounter.scene == scene.name) {
			//check for daynight options
			let do_check = false;
			//check for day
			if (encounter.daynight == "Day" && scene.data.darkness == 0) {
				do_check = true;
			}
			else if (encounter.daynight == "Night" && scene.data.darkness == 1) {
				do_check = true;
			}
			else if (encounter.daynight == "None") {
				do_check = true;
			}
			console.debug("random-encounters | day/night/none encounter", do_check)
			if (do_check) {
				let inroom = await RandomEncounter.checkRooms(scene, encounter.rooms);
				console.debug("random-encounters | room encounter", inroom)
				if (inroom) {
					//do roll check if one is set
					if(encounter.chance == "") {
						doRollTable = true;
					}
					else {
						//do roll
						var roll = new Roll(encounter.chance, {}).evaluate({"async":false}).total;
						//check for range
						if(encounter.onresult.includes("-")) {
							var range = encounter.onresult.split("-");
							//if roll is within range do table
							if(roll >= parseInt(range[0]) && roll <= parseInt(range[1])) {
								doRollTable = true;
							}
						}
						//check roll against value
						else {
							if(roll == parseInt(encounter.onresult)) {
								doRollTable = true;
							}
						}
					}
					console.debug("random-encounters | die chance encounter", doRollTable)
				}
			}
		}
		
		if(doRollTable) {
			console.log(`random-encounters | random encounter '${encounter.name}' has been triggered`)
			let tableRoll = await game.tables.find(t => t.name == encounter.rolltable).roll()
			let tableResult = tableRoll.results[0]
			let text = tableResult.data.text
			if (tableResult.data.collection) {
				text = "@Compendium[" + tableResult.data.collection + "." + tableResult.data.resultId + "]{" + text + "}"
			}
			RandomEncounter.printEncounter(encounter.name, text);
		}
		else {
			RandomEncounter.printMessage(encounter.name, "No Random Encounter");
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
			classes: ["random-encounters", "settings"],
			popOut: true,
			template: "modules/random-encounters/templates/encounters.html",
			height: 'auto',
			id: 'random-encounters-application',
			title: game.i18n.localize("RandomEncounter.button.name"),
			width: 600,
			submitOnClose: false,
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
					console.log("random-encounters | running from about-time")
					RandomEncounter.doRandomEncounter(encounter);
				}
				encounters[i].timeout_id = game.Gametime.doEvery({minutes: encounters[i].time}, doEncounter, encounters[i])
			}
			game.settings.set("random-encounters", "encounters", encounters)
			game.Gametime._save();
		}
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
		let encounters = game.settings.get("random-encounters", "encounters");
		let updateData = {
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
		const el = $(event.target).closest(".encounter-entry");
		if (!el) {
			return true;
		}
		
		let encounters = game.settings.get("random-encounters", "encounters");
		
		let rmEncounter = encounters[el.data("idx")]
		game.Gametime.clearTimeout(rmEncounter.timeout_id)
		game.Gametime._save();
		encounters.splice(el.data("idx"), 1);
		game.settings.set("random-encounters", "encounters", encounters)
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


Hooks.on("ready", function () {
	if (!game.users.filter(a => a.id == game.userId)[0].isGM)
		return true;

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

	game.settings.register("random-encounters", "key", {
		name: "RandomEncounter.Keybind",
		hint: "RandomEncounter.KeybindHint",
		scope: "world",
		config: true,
		default: "Shift + R",
		type: KeyBinding,
	});
});

Hooks.once("init", function () {
	console.log("random-encounters | initializing")
	window.addEventListener("keydown", ev => {
		//only allow for non repeat keys on the body by the GM
		if (ev.repeat || document.activeElement.tagName !== "BODY" || !game.users.filter(a => a.id == game.userId)[0].isGM)
			return true;

		let setting_key = game.settings.get("random-encounters", "key")
		if (setting_key != null) {
			const key = KeyBinding.parse(setting_key)
			if (KeyBinding.eventIsForBinding(ev, key)) {
				ev.preventDefault();
				ev.stopPropagation();
				console.debug("random-encounters | hotkey pressed")
				RandomEncounter.doRandomEncounters();
			}
		}
	});
});

//Hooks.on("createRollTable", function() {
	//refresh settings window so it can get the new roll table name
//	RandomEncounterSettings.do_render();
//});

