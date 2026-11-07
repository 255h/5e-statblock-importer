# 5e JSON Statblock Importer

Дополнение для Foundry VTT и системы **Dungeons & Dragons Fifth Edition**: создаёт NPC из структурированного JSON.

## Установка

В Foundry VTT откройте **Add-on Modules → Install Module** и вставьте ссылку в поле **Manifest URL**:

```text
https://github.com/255h/5e-statblock-importer/releases/latest/download/module.json
```

Релизы и готовые архивы: [GitHub Releases](https://github.com/255h/5e-statblock-importer/releases).

Начиная с v3.0.0 окно импорта и API принимают JSON вместо текстового статблока. Формат описан ниже; уже созданные актёры не требуют преобразования.

## Использование

1. На вкладке актёров нажмите **Import JSON Statblock**.
2. Вставьте JSON в редактор или выберите файл `.json` через **Load JSON file**.
3. Нажмите **Parse** и раскройте **Parsed data preview** для просмотра распознанных данных. **Auto parse** проверяет JSON после редактирования.
4. Выберите папку актёров и нажмите **Import**. После импорта откроется лист созданного NPC.

При ошибке показывается путь к полю, например `$.actions[0].attack.toHit`. Исправьте JSON и повторите импорт. Неизвестные поля отклоняются, чтобы опечатки не приводили к незаметной потере данных.

**[Полный пример: Glabrezu](examples/glabrezu.json)** — готовый файл для загрузки в окно импорта.

**[Пример персонажа на русском](examples/russian-character.json)** — готовый NPC с русскими именами, описаниями, мультиатакой и легендарным сопротивлением.

### Русские названия и описания

Имена NPC, названия действий, особенностей и заклинательных блоков, а также описания поддерживают русский язык, `ё`, кавычки и переносы строк. Регистр и текст этих названий сохраняются. В описаниях сохраняется обогащение бросков и ссылок Foundry.

Механику русских способностей задавайте явными полями (`attack`, `save`, `damage`, `perDay` и т. д.): автоматическое распознавание фраз рассчитано на английские статблоки. Системные ключи и ID (`str`, `humanoid`, `fire`, `prone`, `common`) остаются английскими.

Русские названия снаряжения и заклинаний ищутся в компендиумах с такими же названиями. Автоматического перевода названий между русским и английским нет.

## Формат JSON

Один JSON-объект описывает одного NPC. Обязательно только непустое поле `name`; остальные поля можно опускать. Значения `null` не используются. Имена полей чувствительны к регистру. Числа передаются числами, логические значения — `true`/`false`, формулы бросков — строками. Расстояния задаются в футах.

Это формат данного дополнения, а не JSON экспорта Actor из Foundry.

### Минимальный практический пример

```json
{
  "name": "Goblin",
  "size": "small",
  "type": "humanoid",
  "alignment": "neutral evil",
  "armor": { "ac": 15 },
  "health": { "value": 7, "formula": "2d6" },
  "abilities": { "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8 },
  "speeds": { "walk": 30 },
  "skills": { "stealth": 6 },
  "senses": { "darkvision": 60 },
  "language": { "knownLanguages": ["common", "goblin"] },
  "challenge": { "cr": "1/4", "xp": 50 },
  "actions": [
    {
      "name": "Scimitar",
      "description": "The goblin strikes with its scimitar.",
      "attack": { "toHit": 4 },
      "reach": 5,
      "damage": { "damageRoll": "1d6", "damageMod": 2, "damageType": "slashing" },
      "target": { "type": "creature", "amount": 1 }
    }
  ],
  "bonusActions": [
    { "name": "Nimble Escape", "description": "The goblin takes the Disengage or Hide action." }
  ]
}
```

### Основные поля

| Поле | Формат и назначение |
| --- | --- |
| `name` | Имя NPC. |
| `size` | `tiny`, `small`, `medium`, `large`, `huge`, `gargantuan`. По умолчанию `medium`. Поддерживаются прежние размеры `fine`, `diminutive`, `colossal`. |
| `type` | Тип существа, например `humanoid`, `fiend`, `dragon`. |
| `customType` | Название нестандартного типа; при наличии используется вместо `type`. |
| `race` | Подтип, например `demon`. |
| `swarmSize` | Размер существ в рое, например `tiny`. |
| `alignment` | Мировоззрение. |
| `armor` | `{ "ac": 17, "types": ["natural armor"] }`. Поле `types` необязательно. Если снаряжение не обеспечивает заданный КД, применяется фиксированное значение. Для учтённого Mage Armor укажите `"mage"` в `types`. |
| `health` | `{ "value": 157, "formula": "15d10 + 75" }`; `formula` необязательна. |
| `abilities` | Объект с числовыми характеристиками: `str`, `dex`, `con`, `int`, `wis`, `cha`. Допускаются полные английские названия, например `Strength`. |
| `savingThrows` | Массив характеристик с владением спасбросками, например `["str", "wis"]`. Бонус рассчитывает система. |
| `skills` | Объект с **итоговыми бонусами** навыков, например `{ "stealth": 6, "perception": 4 }`. Допускаются системные ID (`ste`, `prc` и т. д.). Владение рассчитывается после создания NPC. |
| `speeds` | `{ "walk": 30, "fly": 60, "hover": true }`. Также поддерживаются `burrow`, `climb`, `swim`. |
| `senses` | `{ "darkvision": 60, "blindsight": 10 }`. Поддерживаются `tremorsense`, `truesight` и нестандартные чувства. Зрение и режимы обнаружения токена заполняются как прежде. `perception` в этом блоке не задаёт владение навыком — используйте `skills.perception`. |
| `initiative` | `{ "mod": 5, "score": 15 }`; `score` необязателен, для бонуса инициативы используется `mod`. |
| `challenge` | `{ "cr": 9, "xp": 5000, "pb": 4 }`. Дробный CR: `0.5`, `"1/2"`, `"1/4"`, `"1/8"`, `"½"`. При отсутствии CR можно передать `pb` для прежнего расчёта приблизительного CR. Опыт и обычный бонус владения рассчитываются системой по CR. |
| `language` | `{ "knownLanguages": ["common"], "unknownLanguages": ["all languages"], "telepathy": 120 }`. Все вложенные поля необязательны. |
| `gear` | Массив `{ "name": "shield", "quantity": 1 }`. Количество по умолчанию 1. Снаряжение ищется в настроенных компендиумах; у найденного оружия-действия обновляется количество. Броню и щиты указывайте здесь отдельно от `armor.types`. |
| `source` | `{ "book": "Monster Manual", "page": 123 }`. |
| `otherInfo` | Массив строк для биографии; сохранена обработка заголовков из прежнего импортёра. |
| `role` | Роль MCDM, например `Solo`. |
| `souls` | Ресурс MCDM: `{ "value": 3, "formula": "1d6" }`. |

### Сопротивления, уязвимости и иммунитеты

```json
{
  "name": "Resistant Creature",
  "damagesAndConditions": {
    "damageResistances": {
      "types": ["bludgeoning", "piercing", "slashing"],
      "bypasses": ["mgc"],
      "special": "Additional rules text"
    },
    "damageImmunities": { "types": ["poison"] },
    "damageVulnerabilities": { "types": ["radiant"] },
    "conditionImmunities": { "types": ["poisoned", "frightened"] }
  }
}
```

`types` — английские системные идентификаторы в нижнем регистре. `bypasses`: `mgc` — магическое оружие, `ada` — адамантиновое, `sil` — посеребрённое. `special` — дополнительный текст. Все эти поля необязательны. Объединённые иммунитеты статблоков 2024 года задаются отдельно в `damageImmunities` и `conditionImmunities`.

### Действия и особенности

Одинаковый формат элементов используется в массивах:

- `features` — особенности и черты;
- `actions` — действия, в том числе Multiattack;
- `bonusActions` — бонусные действия;
- `reactions` — реакции;
- `legendaryActions`, `lairActions`, `mythicActions` — легендарные действия, действия логова, мифические действия;
- `villainActions` — действия злодея MCDM.

У каждого элемента обязательно `name`; `description` и механика необязательны. Названия и описания можно писать по-русски. Явно заданная механика не зависит от языка описания.

```json
{
  "name": "Dragon",
  "actions": [
    {
      "name": "Огненное дыхание",
      "description": "Дракон выдыхает огонь в конусе длиной 30 футов.",
      "save": { "dc": 15, "ability": "dex", "damageOnSave": "half" },
      "damage": { "damageRoll": "8d6", "damageType": "fire" },
      "target": { "shape": "cone", "range": 30 },
      "recharge": 5
    }
  ]
}
```

| Поле действия | Формат |
| --- | --- |
| `isDescription` | `true` для вводного/общего описания легендарных, мифических, villain-действий или действий логова. Позволяет использовать любое русское имя вместо служебного `Description`. |
| `isMultiattack` | `true` для мультиатаки с произвольным названием; также распознаются имена `Multiattack` и `Мультиатака`. |
| `attack` | `{ "toHit": 7, "condition": "grappled" }`. `condition` необязательно; создаёт эффект состояния. |
| `save` | `{ "dc": 15, "ability": "dex", "damageOnSave": "half", "condition": "prone" }`. `damageOnSave`: `none` (по умолчанию), `half`, `full`. `condition` необязательно. Атака и спасбросок могут присутствовать одновременно. |
| `damage` | `damageRoll`, `damageType`, `damageMod` — основной урон; `plusDamageRoll`, `plusDamageType`, `plusDamageMod` — дополнительный; `versatileDamageRoll`, `versatileDamageType`, `versatileDamageMod` — универсальный. Броски — строки вроде `"2d6"` или `"5"`; модификаторы — отдельные числа. |
| `reach` | Досягаемость в футах. |
| `range` | `{ "near": 80, "far": 320 }`; `far` необязательно. |
| `type` | `weapon` или `spell` для классификации атаки. |
| `target` | Область: `{ "shape": "cone", "range": 30 }`; цель: `{ "type": "creature", "amount": 1, "range": 60 }`. Форма — системный ID Foundry, например `cone`, `line`, `sphere`, `cube`, `cylinder`. |
| `perDay` | Число использований в день. |
| `recharge` | Минимальный результат d6 для перезарядки, например `5` для 5–6. |
| `actionCost` | Стоимость легендарного/мифического действия. |
| `spell` | Для действия-заклинания: `{ "level": 1, "concentration": false }`. |
| `castSpells` | Массив заклинаний для cast-активностей: `[{ "name": "Misty Step", "level": 2 }]`; уровень необязателен. |

В английских описаниях сохранено прежнее распознавание атак, спасбросков, урона, дальности, целей, использований, перезарядки и ссылок на заклинания. Явные JSON-поля имеют приоритет. Ссылки на атаки, броски и состояния в описаниях обогащаются как прежде.

Для настройки ресурсов добавьте элемент с `isDescription: true` в соответствующий массив. Прежнее служебное имя `Description` также поддерживается:

```json
{
  "name": "Legendary Creature",
  "legendaryActions": [
    { "name": "Легендарные действия", "isDescription": true, "description": "Существо может совершить три легендарных действия.", "legendaryActionCount": 3 },
    { "name": "Перемещение", "description": "Существо перемещается на половину своей скорости.", "actionCost": 1 }
  ],
  "lairActions": [
    { "name": "Действия логова", "isDescription": true, "description": "Логово содрогается.", "lairInitiativeCount": 20 }
  ],
  "features": [
    { "name": "Несгибаемая воля", "description": "Существо может преуспеть в проваленном спасброске.", "perDay": 3, "legendaryResistanceCount": 3 }
  ]
}
```

Ресурс легендарного сопротивления создаётся по `legendaryResistanceCount` независимо от названия особенности. Для названий, начинающихся с `Legendary Resistance` или `Легендарное сопротивление`, число также может браться из `perDay`.

### Заклинания

Поддерживаются три независимых блока: `spellcasting`, `innateSpellcasting`, `utilitySpells`. Они используют один формат:

```json
{
  "name": "Mage",
  "abilities": { "int": 16 },
  "challenge": { "cr": 5 },
  "spellcasting": {
    "featureName": "Spellcasting",
    "description": "The mage is a 5th-level spellcaster.",
    "ability": "int",
    "saveDc": 14,
    "level": 5,
    "groups": [
      { "name": "Cantrips", "spells": [{ "name": "Light", "type": "cantrip" }] },
      { "name": "1st level (4 slots)", "spells": [{ "name": "Magic Missile", "type": "slots", "count": 4, "level": 1 }] }
    ]
  },
  "innateSpellcasting": {
    "ability": "int",
    "groups": [
      { "name": "At will", "spells": [{ "name": "Detect Magic", "type": "at will" }] },
      { "name": "1/day each", "spells": [{ "name": "Fly", "type": "innate", "count": 1 }] }
    ]
  }
}
```

- `featureName` — имя особенности, по умолчанию соответствует виду блока.
- `description` — вводное описание, `ability` — заклинательная характеристика, `saveDc` — Сл заклинаний, `level` — уровень заклинателя.
- `groups` содержит группы `{ "name": "…", "spells": [...] }`.
- У заклинания обязательны `name` и `type`: `cantrip`, `slots`, `innate` или `at will`.
- `count` — число ячеек для `slots` или использований в день для `innate`.
- `level` заклинания — уровень применения; для `slots` также задаёт уровень ячеек. Особенно важен для отсутствующих в компендиумах заклинаний.

**Compendium Options** сохраняет выбор и приоритет компендиумов. Настройка **Import Innate Spells as Activities** переключает врождённые и utility-заклинания между cast-активностями особенности и отдельными предметами-заклинаниями. Заклинания ищутся по названиям в компендиумах. Для отсутствующих создаются заглушки и выводится предупреждение. Сохранено предупреждение о заклинаниях из источников 2014 года при игре по правилам 2024 года.

## API

Обе функции принимают JSON-строку или JavaScript-объект указанного формата.

```js
const api = game.modules.get("5e-statblock-importer").api;
const data = {
  name: "Goblin",
  health: {value: 7, formula: "2d6"},
  challenge: {cr: "1/4"}
};

// Проверка и подготовка данных без создания документов.
const parsed = api.parse(data);
console.log(parsed.actor);

const folderId = game.folders.getName("Monsters")?.id;
const {actor5e, importIssues} = await parsed.actor.createActor5e(folderId);

// Либо прямой импорт (создаёт ещё одного NPC).
const imported = await api.import(JSON.stringify(data), folderId);
```

Результат `parse()`:

- `actor` — экземпляр модели импортёра с методом `createActor5e(folderId)`;
- `statBlocks` — `Map` переданных полей и их нормализованных значений;
- `lines` — строки отформатированного входного JSON;
- `unknownLines` — пустой массив: неизвестные JSON-поля считаются ошибкой валидации.

Невалидный JSON вызывает исключение; `import()` отклоняет Promise до создания NPC. Исходный объект API не изменяется. Возвращаемые `importIssues` содержат прежние ключи: `missingSpells`, `obsoleteSpells`, `crNotFound`, если соответствующая проблема обнаружена.

## Проверки

```sh
nix-shell -p nodejs --run 'node --test tests/json-import.test.mjs'
```

Проверка готовых JSON-файлов без запуска Foundry:

```sh
nix-shell -p nodejs --run 'node scripts/validateJson.mjs examples/glabrezu.json examples/russian-character.json'
```

Тесты используют имитацию API Foundry и проверяют преобразование JSON, создание данных NPC, категории действий, заклинания, снаряжение и ошибки валидации. Для проверки интерфейса и поведения листов требуется установленная Foundry VTT с dnd5e.

## Skill генерации персонажей

Подготовлен самодостаточный skill **`generate-foundry-character`** для ChatGPT в браузере:

**[chatgpt-skill/SKILL.md](chatgpt-skill/SKILL.md)**

Весь контракт JSON, правила генерации русскоязычных персонажей/NPC, расчётов и полный пример включены в файл. Доступ к репозиторию, OpenCode или терминалу не требуется. Создаваемый лист — NPC, как и у самого импортёра.

Для загрузки вместе с примерами подготовлен архив **`chatgpt-foundry-character-skill.zip`**. Можно загрузить сам `SKILL.md` в чат ChatGPT и попросить использовать его как инструкцию; если доступна работа с ZIP, можно загрузить архив. Для собственного GPT текст skill можно использовать в инструкциях, а примеры — в файлах знаний. Само прикрепление файла не гарантирует его автоматической активации, поэтому явно попросите следовать инструкции. Пример запроса:

> Прочитай загруженный SKILL.md и следуй ему. Создай на русском NPC — эльфийского следопыта CR 3 с двумя атаками, реакцией и предысторией. Верни готовый JSON для импорта в Foundry; если можешь создавать файлы, приложи elven-ranger.json.

## Credit

Most of the work on the original module was done by [James Haywood](https://github.com/jbhaywood). The [Aioros fork](https://github.com/Aioros/5e-statblock-importer) added support for newer formats and Foundry/dnd5e versions. This version replaces statblock text input with structured JSON.

The original module was based on the [Pathfinder 1e Statblock Library](https://github.com/baileymh/statblock-library).

## License

This work is licensed under Foundry Virtual Tabletop [EULA - Limited License Agreement for module development v 0.1.6](http://foundryvtt.com/pages/license.html).
This Foundry VTT module, originally written by James Haywood, is licensed under the [MIT License](LICENSE).
