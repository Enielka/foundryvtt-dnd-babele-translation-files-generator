const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { ArrayField, SchemaField, StringField, BooleanField } = foundry.data.fields;
import { ExporterInstanciator } from "../exporters/exporter-instanciator.mjs";

export class CompendiumExporterApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(...args) {
        super(...args);

        this._loadPackMapping();
    }

    /** @override */
    static DEFAULT_OPTIONS = {
        id: "compendium-exporter-{id}",
        classes: ["compendium-exporter"],
        tag: "form",
        window: {
            title: "BTFG.CompendiumExporter.Title",
            minimizable: true,
            resizable: true
        },
        actions: {
            toggleCollapse: CompendiumExporterApp.#onToggleCollapse,
            openPack: CompendiumExporterApp.#onOpenPack,
            addMapping: CompendiumExporterApp.#addMapping,
            deleteMapping: CompendiumExporterApp.#deleteMapping,
            exportMapping: CompendiumExporterApp.#exportMapping,
            importMapping: CompendiumExporterApp.#importMapping,
            unselectFile: CompendiumExporterApp.#unselectFile
        },
        form: {
            handler: CompendiumExporterApp.#onHandleSubmit,
            submitOnChange: true,
            closeOnSubmit: false
        },
        position: {
            width: 1100,
            height: 800
        }
    };

    /** @override */
    static PARTS = {
        sidebar: {
            id: "sidebar",
            classes: ["sidebar"],
            template: "modules/dnd5e-babele-translation-files-generator/templates/sidebar.hbs"
        },
        export: {
            id: "export",
            classes: ["export-options"],
            template: "modules/dnd5e-babele-translation-files-generator/templates/export.hbs",
            templates: ["templates/generic/tab-navigation.hbs"],
            scrollable: [""]
        },
        footer: {
            classes: ["flexrow"],
            template: "templates/generic/form-footer.hbs",
        }
    };

    /** @override */
    static TABS = [
        { id: "Actor", icon: "fa-solid fa-user", condition: this.IsActorPack.bind(this) },
        { id: "Item", icon: "fa-solid fa-suitcase", condition: this.IsItemPack.bind(this) },
        { id: "Scene", icon: "fa-solid fa-map", condition: this.IsScenePack.bind(this) },
        { id: "JournalEntry", icon: "fa-solid fa-book-open", condition: this.IsJournalEntryPack.bind(this) }
    ];

    /**
    * Data Model.
    * @type {MappingModel}
    */
    #mappings = new MappingModel();

    /**
    * Data Model.
    * @type {MappingModel}
    */
    #options = new OptionsModel();

    /**
    * Currently selected tab.
    */
    #activeTab;

    /**
    * Currently selected pack.
    */
    #packId;

    /**
    * Currently packs ids.
    */
    #packsIds;

    /**
    * Currently selected packs.
    */
    #selectedPacks;

    /**
    * Currently selected file.
    */
    #selectedFile;

    /** @inheritDoc */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        // Pack
        const pack = this._getPack();
        context.pack = pack;
        context.packName = pack ? pack.metadata.label : game.i18n.localize("BTFG.CompendiumExporter.BulkExport");
        context.packIcon = pack ? CONFIG[pack.metadata.type].sidebarIcon : "fa-solid fa-book-atlas";

        const babele = game?.babele;
        context.translatedPack = babele?.initialized && pack
            ? babele.packs.find(p => p.metadata.id === pack.metadata.id)?.translated
            : false;

        // Packs
        this.#packsIds = [];
        var packs = {};
        game.packs.forEach(pack => {
            this.#packsIds.push(pack.metadata.id);

            const packageName = pack.metadata.packageName;
            if (!packs[packageName]) packs[packageName] = {
                icon: foundry.packages.PACKAGE_TYPES[pack.metadata.packageType]?.icon
            };

            packs[packageName][pack.metadata.name] = {
                id: pack.metadata.id,
                label: pack.metadata.label,
                type: pack.metadata.type,
                icon: CONFIG[pack.metadata.type].sidebarIcon
            };
        });

        context.packs = packs;

        context.selectedPacks = this.#selectedPacks;

        // Tabs
        this.#activeTab = !this.#activeTab ? "Actor" : this.#activeTab;
        context.tabs = this.constructor.TABS.reduce((tabs, { id, icon, condition }) => {
            if (!condition || condition(context.pack)) tabs.push({
                id, icon,
                group: "mapping",
                active: this.#activeTab === id,
                label: `DOCUMENT.${id}`,
                cssClass: [this.#activeTab === id ? "active" : null].filterJoin(" ")
            });
            return tabs;
        }, []);

        // Mappings
        const mappings = (context.mappings = []);
        for (const [i, mapping] of this.#mappings[this.#activeTab].entries()) {
            mappings[this.#activeTab] ??= [];
            mappings[this.#activeTab].push({
                idx: i,
                key: {
                    field: this.#mappings.schema.getField(`${this.#activeTab}.element.key`),
                    value: mapping.key,
                    name: `${this.#activeTab}.${i}.key`,
                    placeholder: "customKey"
                },
                value: {
                    field: this.#mappings.schema.getField(`${this.#activeTab}.element.value`),
                    value: mapping.value,
                    name: `${this.#activeTab}.${i}.value`,
                    placeholder: "system.subData.customKey"
                }
            });
        }

        // Selected File
        context.selectedFileName = this.#selectedFile?.name;

        // Options
        context.includeCustomMappingInFiles = {
            field: this.#options.schema.getField("includeCustomMappingInFiles"),
            value: this.#options.includeCustomMappingInFiles,
        };

        context.exportMappingWithPacks = {
            field: this.#options.schema.getField("exportMappingWithPacks"),
            value: this.#options.exportMappingWithPacks,
        };

        context.sortEntries = {
            field: this.#options.schema.getField("sortEntries"),
            value: this.#options.sortEntries,
        };

        context.useIdAsKey = {
            field: this.#options.schema.getField("useIdAsKey"),
            value: this.#options.useIdAsKey,
        };

        // Buttons
        context.buttons = [
            {
                type: "submit",
                icon: "fa-solid fa-check",
                label: "BTFG.CompendiumExporter.GenerateFile",
            }
        ];

        return context;
    }

    /** @inheritDoc */
    changeTab(tab, group, options = {}) {
        super.changeTab(tab, group, options);
        this.#activeTab = tab;
        this.render({ parts: ["export"] });
    }

    /**
     * Handle toggling the collapsed state of a collapsible section.
     * @this {CompendiumBrowser}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
     */
    static async #onToggleCollapse(event, target) {
        target.closest(".collapsible")?.classList.toggle("collapsed");
    }

    /**
     * Handle opening a compendium.
     * @this {CompendiumExporterApp}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
     */
    static async #onOpenPack(event, target) {
        const dataPackId = target.getAttribute("data-pack-id");
        if (this.#packId === dataPackId) return;
        this.#packId = dataPackId;

        const pack = this._getPack();
        this.#activeTab = (!pack || !pack.metadata?.type)
            ? "Actor" : ["Actor", "Item", "Scene", "JournalEntry"].includes(pack.metadata.type)
                ? pack.metadata.type : "Actor";

        this._loadPackMapping();

        this.render({ parts: ["export"] });
    }

    /**
     * Add a custom mapping.
     * @this {CompendiumExporterApp}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
     */
    static async #addMapping(event, target) {
        const mappings = this.#mappings.toObject()[this.#activeTab];
        mappings.push({ key: "", value: "" });
        this.#mappings.updateSource({ [this.#activeTab]: mappings });
        this.render({ parts: ["export"] });
    }

    /**
     * Delete a custom mapping.
     * @this {CompendiumExporterApp}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
     */
    static async #deleteMapping(event, target) {
        const idx = parseInt(target.dataset.idx);
        const mappings = this.#mappings.toObject()[this.#activeTab];
        mappings.splice(idx, 1);
        this.#mappings.updateSource({ [this.#activeTab]: mappings });
        await this._savePackMapping();
        this.render({ parts: ["export"] });
    }

    /**
     * Export custom mapping.
     * @this {CompendiumExporterApp}
     * @param {PointerEvent} event  The originating click event.
     * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
     */
    static async #exportMapping(event, target) {
        event.preventDefault();

        const formattedData = this._formatExportMapping();

        if (formattedData) {
            const pack = this._getPack();
            const filename = pack ? `mapping-${pack.metadata.label}` : "mapping";
            foundry.utils.saveDataToFile(JSON.stringify(formattedData, null, 2), "text/json", `${filename}.json`);
        }
    }

    /**
    * Import custom mapping.
    * @this {CompendiumExporterApp}
    * @param {PointerEvent} event  The originating click event.
    * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
    */
    static async #importMapping(event, target) {
        event.preventDefault();

        const input = target.closest(".mapping-actions")?.querySelector('#import-custom-mapping-input');
        if (!input) return;

        input.value = "";
        input.addEventListener('change', (e) => this._overrideMappings(e));

        input.click();
    }

    /**
    * Import custom mapping.
    * @this {CompendiumExporterApp}
    * @param {PointerEvent} event  The originating click event.
    * @param {HTMLElement} target  The capturing HTML element which defined a [data-action].
    */
    static #unselectFile(event, target) {
        event.preventDefault();

        this.#selectedFile = null;

        this.render({ parts: ["export"] });
    }

    /**
    * Handle form submission with selection.
    * @this {CompendiumExporterApp}
    * @param {SubmitEvent} event          The form submission event.
    * @param {HTMLFormElement} form       The submitted form element.
    * @param {FormDataExtended} formData  The data from the submitted form.
    */
    static async #onHandleSubmit(event, form, formData) {
        switch (event.type) {
            case "change":
                if (event.target?.files && event.target.files[0] && 'existingFile' === event.target.id) {
                    this.#selectedFile = event.target.files[0];
                    await this._loadFileMapping();
                }

                const data = foundry.utils.duplicate(formData.object);

                this.#selectedPacks = Object.keys(data).filter(key => this.#packsIds.includes(key) && data[key] === true);

                this.#options.updateSource(foundry.utils.duplicate(data))

                this.#mappings.updateSource(foundry.utils.duplicate(data));
                await this._savePackMapping();

                this.render({ parts: ["export"] });
                break;
            case "submit":
                var pack = this._getPack();

                if (!this.#options.exportMappingWithPacks && (this.#selectedPacks?.length ?? 0) === 1) {
                    pack = this._getPack(this.#selectedPacks[0]);
                }

                const options = {
                    mapping: this.#mappings,
                    sortEntries: this.#options.sortEntries,
                    useIdAsKey: this.#options.useIdAsKey
                };

                if (pack) {
                    await ExporterInstanciator.createForPack(pack, options, this.#selectedFile).export();
                }
                else {
                    await this._exportPacks();
                }
                break;
        }
    }

    /**
   * @returns {CompendiumCollection|null}
   * @private
   */
    _getPack(packId) {
        packId ??= this.#packId
        if (!packId) return null;

        const pack = game.packs.get(packId);
        if (!pack) {
            ui.notifications.error(game.i18n.format('BTFG.CompendiumExporter.CompendiumNotFound', { id: packId }));
            return null;
        }

        return pack;
    }

    _loadPackMapping() {
        const packsMappings = game.settings.get("dnd-btfg", "packs-mappings");
        const pack = this.#packId ?? "massive-export";
        this.#mappings.updateSource(packsMappings[pack.replace('.', '-')] ?? {
            Actor: [], Item: [], Scene: [], JournalEntry: []
        });
    }

    async _savePackMapping() {
        const savedMapping = game.settings.get("dnd-btfg", "packs-mappings");
        const pack = this.#packId ?? "massive-export";
        savedMapping[pack.replace('.', '-')] = this.#mappings;
        await game.settings.set("dnd-btfg", "packs-mappings", savedMapping);
    }

    async _overrideMappings(e) {
        e.preventDefault();

        if (!e.target?.files || !e.target.files[0] || 'import-custom-mapping-input' !== e.target.id) return;

        await this._loadFileMapping(e.target.files[0]);
    }

    _formatExportMapping() {
        const pack = this._getPack();

        const filteredTypes = {
            Adventure: ["Actor", "Item", "Scene", "JournalEntry"],
            Actor: ["Actor", "Item"]
        };

        const allowedTypes = pack ? filteredTypes[pack.metadata.type] || [`${pack.metadata.type}`] : Object.keys(this.#mappings);

        const formattedData = Object.fromEntries(
            Object.entries(this.#mappings)
                .filter(([type]) => allowedTypes.includes(type))
                .map(([type, entries]) => [
                    type,
                    entries.reduce((acc, { key, value }) => {
                        acc[key] = value;
                        return acc;
                    }, {})
                ]).filter(([_, obj]) => Object.keys(obj).length > 0)
        );

        // Allow defualt mapping in bulk export
        // if (Object.keys(formattedData).length === 0) {
        //     ui.notifications.warn(game.i18n.format('BTFG.CompendiumExporter.NoExportCustomMapping', {
        //         pack: pack ? pack.metadata.label : game.i18n.localize("BTFG.CompendiumExporter.BulkExport")
        //     }));
        //     return null;
        // }

        return formattedData;
    }

    async _exportPacks() {
        const zip = new JSZip();
        const options = {
            mapping: this.#mappings,
            sortEntries: this.#options.sortEntries,
            useIdAsKey: this.#options.useIdAsKey,
            asZip: true
        };

        var mapping = this._formatExportMapping();

        const progressBar = ui.notifications.info("BTFG.Exporter.ExportRunning", { localize: true, progress: true });
        var progressNbImported = 0;

        for (const packId of this.#selectedPacks) {
            const pack = game.packs.get(packId);
            if (!pack) continue;

            const exporter = ExporterInstanciator.createForPack(pack, options);
            await exporter.export();

            var dataset = exporter._getDataset();
            if (pack.metadata.type === "Adventure") {
                const adventureTypes = { actors: "Actor", items: "Item", scenes: "Scene", journals: "JournalEntry" };
                for (const type of Object.keys(dataset.mapping)) {
                    const packType = adventureTypes[type];
                    mapping[packType] ??= {}
                    mapping[packType] = foundry.utils.mergeObject(mapping[packType], dataset.mapping[type]);
                }
            } else {
                if (mapping[pack.metadata.type]) {
                    mapping[pack.metadata.type] = foundry.utils.mergeObject(mapping[pack.metadata.type], dataset.mapping);
                }
            }

            if (!this.#options.includeCustomMappingInFiles) delete dataset.mapping;

            zip.file(`${pack.metadata.id}.json`, JSON.stringify(dataset, null, 2));

            ++progressNbImported;
            progressBar.update({ pct: progressNbImported / this.#selectedPacks.length });
        }

        if (this.#options.exportMappingWithPacks) {
            zip.file("mapping.json", JSON.stringify(mapping, null, 2));
        }

        ui.notifications.info(game.i18n.localize('BTFG.Exporter.ExportFinished'));

        zip.generateAsync({ type: "blob" }).then((content) => {
            foundry.utils.saveDataToFile(content, "application/zip", "compendium-export.zip");
        });
    }

    async _loadFileMapping(file = null) {
        file ??= this.#selectedFile

        try {
            const jsonString = await foundry.utils.readTextFromFile(file);
            const json = JSON.parse(jsonString);

            const pack = this._getPack();

            const allMapping = ["Actor", "Item", "Scene", "JournalEntry"];

            if (pack && !allMapping.includes(pack.metadata.type)) return;

            const filteredTypes = {
                Adventure: allMapping,
                Actor: ["Actor", "Item"]
            };

            const allowedTypes = pack ? filteredTypes[pack.metadata.type] || [`${pack.metadata.type}`] : Object.keys(this.#mappings);

            const mapping = json.mapping ? { [pack.metadata.type]: json.mapping } : json;

            const formattedMappings = Object.fromEntries(
                Object.entries(mapping)
                    .filter(([type]) => allowedTypes.includes(type))
                    .map(([type, entries]) => [
                        type,
                        Object.entries(entries)
                            .filter(([_, value]) => typeof value === "string")
                            .map(([key, value]) => ({ key, value }))
                    ])
            );

            if (Object.keys(formattedMappings).length === 0) {
                ui.notifications.warn(game.i18n.format('BTFG.CompendiumExporter.NoImportCustomMapping', {
                    pack: pack ? pack.metadata.label : game.i18n.localize("BTFG.CompendiumExporter.BulkExport"),
                    file: file.name
                }));
                return;
            }

            this.#mappings.updateSource(formattedMappings);
            await this._savePackMapping();

            this.render({ parts: ["export"] });
        } catch (error) {
            ui.notifications.error(game.i18n.format('BTFG.Errors.CanNotReadFile', {
                name: file.name
            }));

            console.error(error);
        }
    }

    /**
     * Check whether a pack matches a given type.
     * @param {Object} pack - Pack to check.
     * @param {Array<string>} validTypes - Accepted types.
     * @returns {boolean}
     */
    static IsPackType(pack, validTypes) {
        if (!pack) return true;
        return validTypes.includes(pack.metadata.type);
    }

    /** Determine whether an Pack is Actor type. */
    static IsActorPack(pack) {
        return this.IsPackType(pack, ["Actor", "Adventure"]);
    }

    /** Determine whether an Pack is Item type. */
    static IsItemPack(pack) {
        return this.IsPackType(pack, ["Item", "Actor", "Adventure"]);
    }

    /** Determine whether an Pack is Scene type. */
    static IsScenePack(pack) {
        return this.IsPackType(pack, ["Scene", "Adventure"]);
    }

    /** Determine whether an Pack is JournalEntry type. */
    static IsJournalEntryPack(pack) {
        return this.IsPackType(pack, ["JournalEntry", "Adventure"]);
    }

    /**
   * Inject the compendium exporter button into the compendium sidebar.
   * @param {HTMLElement} html  HTML of the sidebar being rendered.
   */
    static injectSidebarButton(html) {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.add("open-compendium-manager");
        button.innerHTML = `
            <i class="fa-solid fa-download" inert></i>
            ${game.i18n.localize("BTFG.CompendiumExporter.Open")}`;

        button.addEventListener("click", event => (new CompendiumExporterApp()).render({ force: true }));

        let headerActions = html.querySelector(".header-actions");
        if (!headerActions) {
            headerActions = document.createElement("div");
            headerActions.className = "header-actions action-buttons flexrow";
            html.querySelector(":scope > header").insertAdjacentElement("afterbegin", headerActions);
        }
        headerActions.append(button);
    }
}

class MappingModel extends foundry.abstract.DataModel {
    /** @inheritdoc */
    static defineSchema() {
        return {
            Actor: new ArrayField(
                new SchemaField({
                    key: new StringField({ required: true }),
                    value: new StringField({ required: true })
                })
            ),
            Item: new ArrayField(
                new SchemaField({
                    key: new StringField({ required: true }),
                    value: new StringField({ required: true })
                })
            ),
            Scene: new ArrayField(
                new SchemaField({
                    key: new StringField({ required: true }),
                    value: new StringField({ required: true })
                })
            ),
            JournalEntry: new ArrayField(
                new SchemaField({
                    key: new StringField({ required: true }),
                    value: new StringField({ required: true })
                })
            )
        };
    }
}

class OptionsModel extends foundry.abstract.DataModel {
    /** @inheritdoc */
    static defineSchema() {
        return {
            includeCustomMappingInFiles: new BooleanField({
                label: "BTFG.CompendiumExporter.IncludeCustomMappingInFiles",
            }),
            exportMappingWithPacks: new BooleanField({
                label: "BTFG.CompendiumExporter.ExportMappingWithPacks",
            }),
            sortEntries: new BooleanField({
                label: "BTFG.CompendiumExporter.SortEntriesAlpha",
            }),
            useIdAsKey: new BooleanField({
                label: "BTFG.CompendiumExporter.UseIdAsKey",
            })
        };
    }
}