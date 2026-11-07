import { sbiActor } from "./sbiActor.js";
import { sbiParser } from "./sbiParser.js";
import { sbiUtils } from "./sbiUtils.js";

const actionBlocks = ["features", "actions", "bonusActions", "reactions", "legendaryActions", "lairActions", "mythicActions", "villainActions"];
const spellBlocks = ["spellcasting", "innateSpellcasting", "utilitySpells"];
const abilities = ["str", "dex", "con", "int", "wis", "cha"];

// Validate before creating Foundry documents. Error paths identify the JSON field.
function fail(path, expected) {
    throw new Error(`${path}: expected ${expected}.`);
}

function string(value, path) {
    if (typeof value !== "string") fail(path, "a string");
    return value;
}

function number(value, path) {
    if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "a finite number");
    return value;
}

function boolean(value, path) {
    if (typeof value !== "boolean") fail(path, "a boolean");
    return value;
}

function arrayOf(validator) {
    return (value, path) => {
        if (!Array.isArray(value)) fail(path, "an array");
        return value.map((entry, i) => validator(entry, `${path}[${i}]`));
    };
}

function object(value, path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "an object");
    return value;
}

function shape(fields, required = []) {
    return (value, path) => {
        object(value, path);
        for (const key of required) {
            if (!Object.hasOwn(value, key)) fail(`${path}.${key}`, "a value");
        }
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
            if (!Object.hasOwn(fields, key)) throw new Error(`${path}.${key}: unknown field.`);
            result[key] = fields[key](entry, `${path}.${key}`);
        }
        return result;
    };
}

function nonempty(value, path) {
    const result = string(value, path).trim();
    if (!result) fail(path, "a non-empty string");
    return result;
}

function ability(value, path) {
    const result = sbiUtils.convertToShortAbility(nonempty(value, path));
    if (!abilities.includes(result)) fail(path, "str, dex, con, int, wis or cha");
    return result;
}

function pairs(value, path) {
    object(value, path);
    return Object.entries(value).map(([name, entry]) => ({name, value: number(entry, `${path}.${name}`)}));
}

function challengeRating(value, path) {
    if (typeof value === "string" && /^(1\/(2|4|8)|½)$/.test(value)) {
        return value === "½" ? 0.5 : 1 / Number(value.slice(2));
    }
    return number(value, path);
}

const strings = arrayOf(string);
const roll = shape({value: number, formula: string}, ["value"]);
const damageTraits = shape({types: strings, bypasses: strings, special: string});
const actionFields = {
    name: nonempty,
    description: string,
    isDescription: boolean,
    isMultiattack: boolean,
    attack: shape({toHit: number, condition: string}, ["toHit"]),
    save: shape({dc: number, ability, condition: string, damageOnSave: (value, path) => {
        if (!["half", "none", "full"].includes(value)) fail(path, "half, none or full");
        return value;
    }}, ["dc", "ability"]),
    damage: shape(Object.fromEntries([
        "damageRoll", "damageType", "plusDamageRoll", "plusDamageType", "versatileDamageRoll", "versatileDamageType"
    ].map(key => [key, string]).concat([
        ["damageMod", number], ["plusDamageMod", number], ["versatileDamageMod", number]
    ]))),
    range: shape({near: number, far: number}, ["near"]),
    reach: number,
    type: (value, path) => {
        if (!["weapon", "spell"].includes(value)) fail(path, "weapon or spell");
        return value;
    },
    target: shape({range: number, shape: string, type: string, amount: number}),
    perDay: number,
    recharge: number,
    actionCost: number,
    legendaryActionCount: number,
    legendaryResistanceCount: number,
    lairInitiativeCount: number,
    spell: shape({level: number, concentration: boolean}),
    castSpells: arrayOf(shape({name: nonempty, level: number}, ["name"]))
};

function action(value, path) {
    const {name, description = "", ...mechanics} = shape(actionFields, ["name"])(value, path);
    const text = name === "Description" ? description : `${name}. ${description}`;
    const data = {name, value: {
        displayName: name,
        description,
        isDescription: mechanics.isDescription ?? name === "Description",
        isMultiattack: mechanics.isMultiattack ?? ["multiattack", "мультиатака"].includes(name.toLowerCase()),
        lines: text.split("\n").map((line, lineNumber) => ({line, lineNumber, matchData: []}))
    }};
    // Retain recognition from descriptions; explicit mechanics take precedence.
    for (const method of ["parseAttackOrSave", "parsePerDay", "parseRange", "parseReach", "parseRecharge", "parseTarget", "parseSpellAction", "parseCastAction"]) {
        sbiParser[method](data);
    }
    sbiParser.parseMajorFeatureInfo({name: data.value.isDescription ? "Description" : name, value: data.value});
    Object.assign(data.value, mechanics);
    if (data.value.save) data.value.save.damageOnSave ??= "none";
    if (/^(legendary resistance|легендарное сопротивление)/iu.test(name)) {
        data.value.legendaryResistanceCount ??= data.value.perDay;
    }
    return data;
}

const spell = shape({
    name: nonempty,
    type: (value, path) => {
        if (!["slots", "innate", "at will", "cantrip"].includes(value)) fail(path, "slots, innate, at will or cantrip");
        return value;
    },
    count: number,
    level: number
}, ["name", "type"]);

function spellcasting(value, path) {
    const data = shape({
        featureName: nonempty, description: string, ability, saveDc: number, level: number,
        groups: arrayOf(shape({name: nonempty, spells: arrayOf(spell)}, ["name", "spells"]))
    })(value, path);
    return {
        featureName: data.featureName ?? (path.endsWith("innateSpellcasting") ? "Innate Spellcasting" : path.endsWith("utilitySpells") ? "Utility Spells" : "Spellcasting"),
        description: data.description ?? "",
        spellcastingDetails: Object.fromEntries(["ability", "saveDc", "level"].filter(key => data[key] !== undefined).map(key => [key, data[key]])),
        spellInfo: [{name: "Description", value: data.description ?? ""}, ...(data.groups ?? []).map(group => ({name: group.name, value: group.spells}))]
    };
}

const fields = {
    name: nonempty,
    size: string, swarmSize: string, type: string, customType: string, race: string, alignment: string, role: string,
    armor: shape({ac: number, types: strings}, ["ac"]),
    health: roll, souls: roll,
    abilities: (value, path) => pairs(value, path).map(entry => ({...entry, name: ability(entry.name, `${path}.${entry.name}`)})),
    savingThrows: arrayOf(ability),
    skills: (value, path) => pairs(value, path).map(entry => {
        if (!["acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv", "med", "nat", "prc", "prf", "per", "rel", "slt", "ste", "sur"].includes(sbiUtils.convertToShortSkill(entry.name))) {
            fail(`${path}.${entry.name}`, "a D&D 5e skill name or ID");
        }
        return entry;
    }),
    senses: pairs,
    speeds: (value, path) => {
        const {hover, ...speeds} = shape({walk: number, burrow: number, climb: number, fly: number, swim: number, hover: boolean})(value, path);
        return [...pairs(speeds, path), ...(hover ? [{name: "hover", value: ""}] : [])];
    },
    challenge: shape({cr: challengeRating, xp: number, pb: number}),
    initiative: shape({mod: number, score: number}, ["mod"]),
    language: shape({knownLanguages: strings, unknownLanguages: strings, telepathy: number}),
    damagesAndConditions: shape({damageImmunities: damageTraits, damageResistances: damageTraits, damageVulnerabilities: damageTraits, conditionImmunities: damageTraits}),
    gear: arrayOf(shape({name: nonempty, quantity: number}, ["name"])),
    otherInfo: strings,
    source: shape({book: string, page: (value, path) => typeof value === "number" ? number(value, path) : string(value, path)}),
    ...Object.fromEntries(actionBlocks.map(key => [key, arrayOf(action)])),
    ...Object.fromEntries(spellBlocks.map(key => [key, spellcasting]))
};

export class sbiJsonParser {
    static parseInput(input) {
        let json;
        try {
            // Spell imports add UUIDs later, so clone API objects as well.
            json = typeof input === "string" ? JSON.parse(input) : JSON.parse(JSON.stringify(input));
        } catch (error) {
            throw new Error(`Invalid JSON: ${error.message}`);
        }
        const data = shape(fields, ["name"])(json, "$");
        const actor = new sbiActor(data.name);
        Object.assign(actor, data);
        if (actor.armor) actor.armor.types ??= [];
        if (actor.language) {
            actor.language.knownLanguages ??= [];
            actor.language.unknownLanguages ??= [];
        }
        actor.gear = actor.gear.map(item => ({name: item.name.toLowerCase(), value: item.quantity ?? 1}));
        for (const trait of Object.values(actor.damagesAndConditions)) {
            trait.types ??= [];
            trait.bypasses ??= [];
            trait.special ??= "";
        }
        const statBlocks = new Map(Object.entries(data));
        return {actor, statBlocks, lines: JSON.stringify(json, null, 2).split("\n"), unknownLines: []};
    }
}
