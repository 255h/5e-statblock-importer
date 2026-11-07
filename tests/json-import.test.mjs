import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let id = 0;
let spellsAsActivities = true;
let createdData;
const updates = [];
const setProperty = (target, path, value) => {
    const parts = path.split(".");
    const key = parts.pop();
    for (const part of parts) target = target[part] ??= {};
    target[key] = value;
    return true;
};

globalThis.foundry = {
    applications: {api: {ApplicationV2: class {}, HandlebarsApplicationMixin: base => base}},
    utils: {setProperty, deepClone: structuredClone, randomID: () => `test${++id}`}
};
globalThis.game = {settings: {get: (module, key) => key === "spellsAsActivities" ? spellsAsActivities : "legacy"}};
globalThis.CONFIG = {Actor: {documentClass: {create: async data => {
    createdData = data;
    return {
        system: {
            attributes: {ac: {value: 10}, prof: 2},
            abilities: {dex: {mod: 2}, str: {mod: 3}, wis: {mod: 2}},
            skills: {ste: {ability: "dex"}, ath: {ability: "str"}, prc: {ability: "wis"}}
        },
        items: [],
        update: async update => updates.push(update)
    };
}}}};
globalThis.Item = {create: async data => ({toObject: () => structuredClone(data), uuid: "Item.placeholder"})};

const {sbiJsonParser} = await import("../scripts/sbiJsonParser.js");
const {sbiUtils} = await import("../scripts/sbiUtils.js");
sbiUtils.getImgFromPackItemAsync = async () => null;
sbiUtils.getItemFromPacksAsync = async (name, type) => {
    if (name === "Missing Spell") return null;
    return {
        name, type, sourceUuid: `Compendium.test.${name}`,
        system: {level: 1, activities: {base: {_id: "base", type: "utility"}}}
    };
};

const activity = item => Object.values(item.system.activities)[0];

test("example imports stats, damage, spells, saves, senses and source", async () => {
    const json = await readFile(new URL("../examples/glabrezu.json", import.meta.url), "utf8");
    const {actor} = sbiJsonParser.parseInput(json);
    await actor.updateActorData();
    const data = actor.actorData;
    assert.equal(data.system.attributes.hp.max, 157);
    assert.equal(data.system.abilities.str.value, 20);
    assert.equal(data.system.abilities.str.proficient, 1);
    assert.equal(data.system.details.cr, 9);
    assert.equal(data.system.attributes.ac.flat, 17);
    assert.deepEqual(data.system.traits.dr.bypasses, ["mgc"]);
    assert.deepEqual(data.system.traits.ci.value, ["poisoned"]);
    assert.equal(data.system.traits.languages.communication.telepathy.value, 120);
    assert.equal(data.system.attributes.movement.walk, 40);
    assert.equal(data.prototypeToken.detectionModes[0].id, "seeAll");
    const pincer = data.items.find(item => item.name === "Pincer");
    assert.equal(activity(pincer).type, "attack");
    assert.equal(pincer.system.damage.base.denomination, 10);
    assert.equal(pincer.effects[0].statuses[0], "grappled");
    const casting = data.items.find(item => item.name === "Innate Spellcasting");
    assert.equal(Object.keys(casting.system.activities).length, 6);
    assert.equal(data.system.source.book, "SRD");
});

test("all action categories and MCDM fields reach actor creation", async () => {
    updates.length = 0;
    const input = {
        name: "JSON Creature", size: "large", swarmSize: "tiny", type: "fiend", race: "demon",
        alignment: "chaotic evil", role: "Solo", armor: {ac: 18},
        abilities: {Strength: 18, dex: 14}, health: {value: 99, formula: "10d10+44"},
        challenge: {cr: "1/2"}, initiative: {mod: 5}, savingThrows: ["Strength"],
        skills: {stealth: 6}, senses: {darkvision: 60}, speeds: {walk: 30, fly: 60, hover: true},
        language: {unknownLanguages: ["all languages"]},
        damagesAndConditions: {damageVulnerabilities: {types: ["radiant"]}},
        gear: [{name: "Shield", quantity: 2}], souls: {value: 3, formula: "1d6"},
        otherInfo: ["Ecology", "A creature from JSON."], source: {book: "Test", page: 42},
        features: [{name: "Legendary Resistance", perDay: 2}],
        actions: [{name: "Breath", save: {dc: 15, ability: "dex"}, damage: {damageRoll: "4d6", damageType: "fire", damageMod: 0}, recharge: 5, target: {shape: "cone", range: 30}}],
        bonusActions: [{name: "Dash", perDay: 3}], reactions: [{name: "Parry"}],
        legendaryActions: [{name: "Description", legendaryActionCount: 4}, {name: "Move", actionCost: 2}],
        lairActions: [{name: "Description", description: "The lair shakes.", lairInitiativeCount: 10}],
        mythicActions: [{name: "Roar"}], villainActions: [{name: "Rush"}],
        utilitySpells: {description: "Utility magic.", ability: "wis", groups: [{name: "At will", spells: [{name: "Light", type: "at will"}]}]}
    };
    const original = structuredClone(input);
    const {actor} = sbiJsonParser.parseInput(input);
    const {importIssues} = await actor.createActor5e("folder-test");
    assert.deepEqual(input, original, "API input is not mutated");
    assert.equal(createdData.folder, "folder-test");
    assert.equal(createdData.type, "npc");
    assert.equal(createdData.system.traits.size, "lg");
    assert.equal(createdData.system.details.type.swarm, "tiny");
    assert.equal(createdData.system.attributes.init.bonus, 3);
    assert.equal(createdData.system.attributes.movement.hover, true);
    assert.equal(createdData.system.resources.legact.max, 4);
    assert.equal(createdData.system.resources.legres.max, 2);
    assert.equal(createdData.system.resources.lair.initiative, 10);
    assert.equal(createdData.items.find(item => item.name === "shield").system.quantity, 2);
    assert.equal(activity(createdData.items.find(item => item.name === "Move")).activation.value, 2);
    assert.equal(activity(createdData.items.find(item => item.name === "Roar")).activation.type, "mythic");
    assert.equal(activity(createdData.items.find(item => item.name === "Rush")).activation.type, "legendary");
    const breath = activity(createdData.items.find(item => item.name === "Breath"));
    assert.equal(breath.type, "save");
    assert.equal(breath.target.template.type, "cone");
    assert.equal(breath.damage.parts[0].bonus, 0);
    assert.ok(createdData.items.some(item => item.name.startsWith("Souls:")));
    assert.ok(createdData.system.details.biography.value.includes("A creature from JSON."));
    assert.ok(updates.some(update => update["system.skills.ste.value"] === 2));
    assert.ok(updates.some(update => update["system.attributes.ac.flat"] === 18));
    assert.deepEqual(importIssues, {});
});

test("descriptions retain attack recognition and explicit mechanics override it", async () => {
    const {actor} = sbiJsonParser.parseInput({
        name: "Attacker", abilities: {str: 18, dex: 10}, challenge: {cr: 1},
        actions: [{name: "Claw", description: "Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 8 (1d8 + 4) slashing damage.", attack: {toHit: 0}, damage: {damageRoll: "1d8", damageType: "slashing", damageMod: 0}}]
    });
    await actor.updateActorData();
    const claw = actor.actorData.items[0];
    assert.equal(claw.system.range.reach, 5);
    assert.equal(activity(claw).attack.bonus, 0);
    assert.equal(claw.system.damage.base.bonus, "@mod -4");
});

test("standard slots, innate items, missing-spell placeholders and cast actions", async () => {
    spellsAsActivities = false;
    try {
        const {actor} = sbiJsonParser.parseInput({
            name: "Caster", challenge: {pb: 3},
            spellcasting: {featureName: "Spellcasting (Arcane)", ability: "int", saveDc: 17, level: 5, description: "Arcane magic.", groups: [{name: "2nd level", spells: [{name: "Missing Spell", type: "slots", level: 2, count: 3}]}]},
            innateSpellcasting: {groups: [{name: "1/day", spells: [{name: "Fly", type: "innate", count: 1}]}]},
            reactions: [{name: "Shield", castSpells: [{name: "Shield", level: 1}], perDay: 2}]
        });
        await actor.updateActorData();
        const data = actor.actorData;
        assert.equal(data.system.spells.spell2.override, 3);
        assert.equal(data.system.attributes.spellcasting, "int");
        assert.equal(data.system.details.spellLevel, 5);
        assert.equal(data.system.bonuses.spell.dc, "6");
        assert.equal(data.items.find(item => item.name === "Fly").system.uses.max, "1");
        assert.deepEqual(actor.importIssues.missingSpells, ["Missing Spell"]);
        assert.equal(activity(data.items.find(item => item.name === "Shield")).type, "cast");
    } finally {
        spellsAsActivities = true;
    }
});

test("invalid JSON and field errors fail before creating an actor", () => {
    for (const [input, error] of [
        ["not JSON", /Invalid JSON/], ["null", /expected an object/], [[], /expected an object/],
        [{}, /\$\.name/], [{name: " "}, /non-empty/],
        [{name: "Bad", health: {value: "10"}}, /\$\.health\.value/],
        [{name: "Bad", actions: [{name: "Bite", attack: {toHit: "5"}}]}, /\$\.actions\[0\]\.attack\.toHit/],
        [{name: "Bad", hitPoints: 10}, /unknown field/],
        [{name: "Bad", abilities: {luck: 10}}, /\$\.abilities\.luck/],
        [{name: "Bad", skills: {unknown: 2}}, /\$\.skills\.unknown/],
        ['{"name":"Bad","__proto__":{}}', /unknown field/]
    ]) assert.throws(() => sbiJsonParser.parseInput(input), error);
});

test("minimal input is valid and CR zero is preserved", async () => {
    const {actor} = sbiJsonParser.parseInput({name: "Minimal", challenge: {cr: 0}});
    await actor.updateActorData();
    assert.equal(actor.actorData.system.details.cr, 0);
    assert.equal(actor.importIssues.crNotFound, false);
});

test("explicit damage modifiers, spell concentration and non-attack targets", async () => {
    const {actor} = sbiJsonParser.parseInput({
        name: "Mechanics", abilities: {str: 18, int: 18}, challenge: {cr: 1},
        spellcasting: {ability: "int"},
        actions: [
            {name: "Staff", attack: {toHit: 6}, reach: 5, damage: {damageRoll: "1d6", damageMod: 4, damageType: "bludgeoning", plusDamageRoll: "1d4", plusDamageType: "fire", plusDamageMod: 2, versatileDamageRoll: "1d8", versatileDamageType: "bludgeoning", versatileDamageMod: 0}},
            {name: "Bolt", attack: {toHit: 6}, type: "spell", range: {near: 60}, damage: {damageRoll: "1d8", damageType: "force", damageMod: 4}, spell: {level: 1, concentration: false}}
        ],
        features: [{name: "Aura", target: {shape: "sphere", range: 10}}],
        legendaryActions: [{name: "Mark", target: {type: "creature", amount: 1, range: 30}}]
    });
    await actor.updateActorData();
    const items = actor.actorData.items;
    const staff = items.find(item => item.name === "Staff");
    assert.equal(activity(staff).damage.parts[0].bonus, 2);
    assert.equal(staff.system.damage.versatile.bonus, "@mod -4");
    const bolt = items.find(item => item.name === "Bolt");
    assert.deepEqual(bolt.system.properties, []);
    assert.equal(activity(bolt).damage.parts[0].bonus, 4);
    assert.equal(activity(items.find(item => item.name === "Aura")).target.template.size, 10);
    assert.equal(activity(items.find(item => item.name === "Mark")).target.affects.count, 1);
});

test("module API accepts JSON strings and objects and rejects bad imports", async () => {
    const hooks = new Map();
    globalThis.Hooks = {on: (name, callback) => hooks.set(name, callback)};
    const module = {};
    game.modules = {get: () => module};
    game.settings.register = () => {};
    game.settings.registerMenu = () => {};
    await import("../scripts/sbi.js");
    hooks.get("init")();
    assert.equal(module.api.parse('{"name":"API"}').actor.name, "API");
    assert.equal(module.api.parse({name: "API Object"}).actor.name, "API Object");
    await module.api.import({name: "Imported", challenge: {cr: 0}}, "api-folder");
    assert.equal(createdData.name, "Imported");
    assert.equal(createdData.folder, "api-folder");
    await assert.rejects(module.api.import('{"name":"Bad","health":"wrong"}'), /\$\.health/);
    assert.equal(createdData.name, "Imported", "invalid imports create no documents");
});

test("Russian names and descriptions survive import without title stripping or lowercasing", async () => {
    const json = JSON.parse(await readFile(new URL("../examples/russian-character.json", import.meta.url), "utf8"));
    json.legendaryActions = [
        {name: "Легендарные действия", isDescription: true, description: "Страж может совершить два легендарных действия.", legendaryActionCount: 2},
        {name: "Шаг сквозь пепел", description: "Страж перемещается на 10 футов.", actionCost: 1}
    ];
    json.lairActions = [{name: "Действия логова", isDescription: true, description: "С потолка падает пепел.", lairInitiativeCount: 15}];
    json.bonusActions = [{name: "Ёж. Стойка «Щит»", description: "Ёж. Первая фраза.\nВторая строка: щит поднят.", perDay: 2}];
    json.innateSpellcasting = {
        featureName: "Врождённая магия", description: "Врождённая магия. Страж произносит заклинания на русском.",
        ability: "wis", groups: [{name: "По желанию", spells: [{name: "Щит", type: "at will"}]}]
    };
    const {actor} = sbiJsonParser.parseInput(json);
    await actor.createActor5e("русская-папка");
    assert.equal(createdData.name, "Страж Пепельной башни");
    for (const block of ["features", "actions", "bonusActions", "reactions", "legendaryActions", "lairActions"]) {
        for (const entry of json[block]) {
            const imported = createdData.items.find(item => item.name === entry.name);
            assert.ok(imported, `name preserved: ${entry.name}`);
            assert.equal(imported.system.description.value, `<p>${entry.description}</p>`);
        }
    }
    assert.equal(createdData.system.resources.legres.max, 1);
    assert.equal(createdData.system.resources.legact.max, 2);
    assert.equal(createdData.system.resources.lair.initiative, 15);
    assert.equal(createdData.items.find(item => item.name === "Мультиатака").system.proficient, undefined);
    const magic = createdData.items.find(item => item.name === "Врождённая магия");
    assert.ok(magic.system.description.value.startsWith(`<p>${json.innateSpellcasting.description}</p>`));
    assert.equal(activity(magic).spell.uuid, "Compendium.test.Щит");
});

test("localized compendium names do not collapse to identical punctuation", async () => {
    const entries = [{_id: "fire", name: "Жар"}, {_id: "ice", name: "Лёд"}];
    const pack = {
        index: entries,
        getDocument: async id => ({toObject: () => ({name: entries.find(entry => entry._id === id).name}), uuid: `Compendium.localized.${id}`})
    };
    const ice = await sbiUtils.getItemFromPackAsync(pack, "лЁд");
    assert.equal(ice.name, "Лёд");
    assert.equal(ice.sourceUuid, "Compendium.localized.ice");
    assert.equal(await sbiUtils.getItemFromPackAsync(pack, "Меч"), null);
    assert.notEqual(sbiUtils.normalizeName("Меч"), sbiUtils.normalizeName("Щит"));
});
