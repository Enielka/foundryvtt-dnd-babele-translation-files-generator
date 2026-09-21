import { AbstractExporter } from './abstract-exporter.mjs';
import { ActiveEffectExporter } from './active-effect-exporter.mjs';

export class ItemExporter extends AbstractExporter {
    static getDocumentData(document, customMapping, datasetMapping) {
        const { name, type, system } = document;
        const documentData = { name };

        if (system?.description.value) documentData.description = system.description.value;
        if (system?.range?.special) documentData.range = system.range.special;
        if (system?.target?.affects?.special) documentData.target = system.target.affects.special;

        const keysToIgnore = ["system.type.subtype"];

        const mappingAdded = this._addCustomMapping(customMapping.Item, document, documentData, type !== "race" ? keysToIgnore : []);

        if (datasetMapping.Item) {
            datasetMapping.Item = foundry.utils.mergeObject(datasetMapping.Item, mappingAdded);
        } else if (datasetMapping.items) {
            datasetMapping.items = foundry.utils.mergeObject(datasetMapping.items, mappingAdded);
        } else {
            datasetMapping = foundry.utils.mergeObject(datasetMapping, mappingAdded);
        }

        if (system?.activities) {
            Object.keys(system.activities).forEach(activity => {
                const { name, activation, description, roll, type, _id, profiles, duration, range, target } = system.activities[activity];
                const currentActivity = {};

                if (name) currentActivity.name = name;
                if (roll?.name) currentActivity.roll = roll.name;
                if (activation?.condition) currentActivity.condition = activation.condition;
                if (description?.chatFlavor) currentActivity.chatFlavor = description.chatFlavor;
                if (description?.value) currentActivity.description = description.value;
                if (duration?.special) currentActivity.duration = duration.special;
                if (range?.special) currentActivity.range = range.special;
                if (target?.affects?.special) currentActivity.target = target.affects.special;

                if (profiles) {
                    const filteredProfiles = profiles
                        .filter(({ name }) => name)
                        .map(({ name }) => [name, name]);

                    if (this._hasContent(filteredProfiles))
                        currentActivity.profiles = Object.fromEntries(filteredProfiles);
                }

                if (Object.keys(currentActivity).length) {
                    documentData.activities = documentData.activities ?? {};
                    let key = type === "cast" && !name ? _id : name?.length ? name : type;
                    key = documentData.activities[key] ? _id : key;
                    documentData.activities[key] = currentActivity;
                }
            });
        }

        const mappingActors = customMapping.Actor.map(m => m.value);
        const mappingItems = customMapping.Item.map(m => m.value);
        const allChanges = [...new Set([...ActiveEffectExporter.DEFAULT_CHANGES, ...mappingActors, ...mappingItems])];
        const effectsData = ActiveEffectExporter.getEffectsData(document.effects, allChanges);
        if (effectsData) documentData.effects = effectsData;

        if (this._hasContent(system?.advancement)) {
            Object.keys(system.advancement).forEach(advancement => {
                const { _id, name, hint } = system.advancement[advancement];
                const advancementData = { ...name && { name }, ...hint && { hint } };

                if (Object.keys(advancementData).length) {
                    documentData.advancement = documentData.advancement ?? {};
                    const key = !name?.length || (documentData.advancement[name] && !foundry.utils.equals(documentData.advancement[name], advancementData)) ? _id : name;
                    documentData.advancement[key] = advancementData;
                }
            });
        }

        return documentData;
    }

    static addBaseMapping(mapping, document, documentData) {
        const { system } = document;
        const { movement, senses, weight, range, target, capacity, activities, advancement } = system;

        const updateMapping = (field, condition, path, converter) => {
            if (!mapping[field] && condition) {
                mapping[field] = { path, converter };
            }
        };

        const movementCondition = movement && ["ft", "mi"].includes(movement.units) &&
            (movement.burrow || movement.climb || movement.swim || movement.walk || movement.fly);
        updateMapping('movement', movementCondition, 'system.movement', 'movement');

        const sensesCondition = senses && ["ft", "mi"].includes(senses.units) && senses.ranges &&
            (senses.ranges.darkvision || senses.ranges.blindsight || senses.ranges.tremorsense || senses.ranges.truesight);
        updateMapping('senses', sensesCondition, 'system.senses', 'senses');

        if (weight && ["lb", "tn"].includes(weight.units) && weight.value) {
            updateMapping('weight', true, 'system.weight', 'weight');
        }

        if (range && ["ft", "mi"].includes(range.units) && (range.value || range.long || range.reach)) {
            updateMapping('range', true, 'system.range', 'range');
        }

        if (target && ["ft", "mi"].includes(target.template?.units) &&
            (target.template.size || target.template.height || target.template.width)) {
            updateMapping('target', true, 'system.target', 'target');
        }

        if (capacity) {
            if (capacity.volume.units === "cubicFoot" && capacity.volume.value) {
                updateMapping('volume', true, 'system.capacity.volume', 'volume');
            }

            if (["lb", "tn"].includes(capacity.weight.units) && capacity.weight.value) {
                updateMapping('capacityWeight', true, 'system.capacity.weight', 'weight');
            }
        }

        if (activities) {
            for (const key in activities) {
                const activity = activities[key];
                const activityCondition = ["ft", "mi"].includes(activity.range?.units) &&
                    (activity.range.value || activity.range.long || activity.range.reach) ||
                    ["ft", "mi"].includes(activity.target?.template?.units) &&
                    (activity.target.template.size || activity.target.template.height ||
                        activity.target.template.width || activity.target.affects.count);

                if (activityCondition) {
                    updateMapping('rangeActivities', true, 'system.activities', 'rangeActivities');
                    break;
                }
            }
        }

        if (this._hasContent(advancement)) {
            for (const adv of Object.values(advancement)) {
                if (adv.type === "ScaleValue" && adv.configuration.type === "distance" &&
                    ["ft", "mi"].includes(adv.configuration.distance.units)) {
                    for (const key in adv.configuration.scale) {
                        if (adv.configuration.scale[key].value) {
                            updateMapping('distanceAdvancement', true, 'system.advancement', 'distanceAdvancement');
                            break;
                        }
                    }
                }
            }
        }

        updateMapping('activities', documentData.activities, 'system.activities', 'activities');
        updateMapping('effects', documentData.effects, 'effects', 'effects');
        updateMapping('advancement', documentData.advancement, 'system.advancement', 'advancement');

        return mapping;
    }

    async _processDataset() {
        const documents = await this.pack.getIndex();

        for (const indexDocument of documents) {
            const document = foundry.utils.duplicate(await this.pack.getDocument(indexDocument._id));
            const documentData = ItemExporter.getDocumentData(document, this.options.mapping, this.dataset.mapping);

            ItemExporter.addBaseMapping(this.dataset.mapping.Item ?? this.dataset.mapping, document, documentData);

            let key = this._getExportKey(document);
            key = this.dataset.entries[key] && !foundry.utils.equals(this.dataset.entries[key], documentData) ? document._id : key;

            this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

            if (!this.options.asZip) this._stepProgressBar();
        }

        ItemExporter._reorderMapping(this.dataset.mapping.Item ?? this.dataset.mapping);
    }
}