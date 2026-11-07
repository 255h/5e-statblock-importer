import { sbiUtils } from "./sbiUtils.js";
import { sbiJsonParser } from "./sbiJsonParser.js";
import { MODULE_NAME, CompendiumOptionsMenu } from "./sbiConfig.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class sbiWindow extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options) {
        super(options);
        this.keyupParseTimeout = null;
    }

    static DEFAULT_OPTIONS = {
        id: "sbi-window",
        position: { width: 800, height: 640 },
        classes: ["sbi-window"],
        window: { resizable: true, title: "5e JSON Statblock Importer" },
        actions: {
            parse: sbiWindow.parse,
            reset: sbiWindow.reset,
            import: sbiWindow.import,
            compendiumOptions: sbiWindow.openCompendiumOptions
        }
    };

    static PARTS = {
        form: { template: `modules/${MODULE_NAME}/templates/sbiWindow.hbs` }
    };

    static sbiInputWindowInstance = null;

    static openCompendiumOptions() {
        new CompendiumOptionsMenu().render(true);
    }

    static async renderWindow() {
        if (!sbiWindow.sbiInputWindowInstance) sbiWindow.sbiInputWindowInstance = new sbiWindow();
        sbiWindow.sbiInputWindowInstance.render(true);
    }

    _onRender(context, options) {
        const input = this.element.querySelector("#sbi-input");
        const fileInput = this.element.querySelector("#sbi-json-file");
        const folderSelect = this.element.querySelector("#sbi-import-select");

        folderSelect.add(new Option("None", ""));
        for (const folder of game.folders) {
            if (folder.type === "Actor") folderSelect.add(new Option(folder.name, folder.id));
        }

        input.addEventListener("input", () => {
            clearTimeout(this.keyupParseTimeout);
            document.getElementById("sbi-preview").textContent = "";
            document.getElementById("sbi-issues").replaceChildren();
            if (document.getElementById("sbi-import-autoparse").checked) {
                this.keyupParseTimeout = setTimeout(() => sbiWindow.parse(), 700);
            }
        });

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files[0];
            if (!file) return;
            try {
                input.value = await file.text();
                input.dispatchEvent(new Event("input"));
                sbiWindow.parse();
            } catch (error) {
                sbiWindow.showError(error);
            } finally {
                fileInput.value = "";
            }
        });
    }

    async close(options) {
        clearTimeout(this.keyupParseTimeout);
        await super.close(options);
        if (sbiWindow.sbiInputWindowInstance === this) sbiWindow.sbiInputWindowInstance = null;
    }

    static showError(error) {
        const issues = document.getElementById("sbi-issues");
        issues.replaceChildren();
        const message = document.createElement("div");
        message.classList.add("sbi-issue");
        message.textContent = error.message;
        issues.appendChild(message);
    }

    static parse() {
        clearTimeout(sbiWindow.sbiInputWindowInstance?.keyupParseTimeout);
        const input = document.getElementById("sbi-input");
        const preview = document.getElementById("sbi-preview");
        document.getElementById("sbi-issues").replaceChildren();
        preview.textContent = "";
        if (!input.value.trim()) return;
        try {
            const result = sbiJsonParser.parseInput(input.value);
            // textContent keeps names and descriptions as text in the preview.
            preview.textContent = JSON.stringify(result.actor, null, 2);
            return result;
        } catch (error) {
            sbiWindow.showError(error);
        }
    }

    static reset() {
        clearTimeout(sbiWindow.sbiInputWindowInstance?.keyupParseTimeout);
        document.getElementById("sbi-input").value = "";
        document.getElementById("sbi-json-file").value = "";
        document.getElementById("sbi-preview").textContent = "";
        document.getElementById("sbi-issues").replaceChildren();
    }

    static async import() {
        const button = document.getElementById("sbi-import-button");
        if (button.disabled) return;
        const result = sbiWindow.parse();
        if (!result) return;
        button.disabled = true;
        const folderId = document.getElementById("sbi-import-select").value || undefined;
        try {
            const {actor5e, importIssues} = await result.actor.createActor5e(folderId);
            sbiWindow.processIssues(importIssues);
            actor5e.sheet.render(true);
        } catch (error) {
            sbiWindow.showError(error);
            sbiUtils.error(error.message, error);
        } finally {
            button.disabled = false;
        }
    }

    static addIssueMessage(content, compendiumLink = false) {
        const issue = document.createElement("div");
        issue.classList.add("sbi-issue");
        issue.textContent = content;
        if (compendiumLink) {
            const link = document.createElement("a");
            link.dataset.action = "compendiumOptions";
            link.textContent = " Compendium Options";
            issue.appendChild(link);
        }
        document.getElementById("sbi-issues").appendChild(issue);
        sbiUtils.warn(issue.textContent);
    }

    static processIssues(issues) {
        if (issues.missingSpells?.length) {
            sbiWindow.addIssueMessage("Some spells could not be found in your compendiums and have been created as placeholders: " + issues.missingSpells.join(", "));
        }
        if (issues.obsoleteSpells?.length) {
            sbiWindow.addIssueMessage("Some spells have been imported from 2014 sources while you are playing with 2024 rules: " + issues.obsoleteSpells.join(", "), true);
        }
        if (issues.crNotFound) {
            sbiWindow.addIssueMessage("Could not find CR information. Some calculated attack information could be wrong.");
        }
    }
}
