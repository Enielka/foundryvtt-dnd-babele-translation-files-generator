import { AbstractExporter } from './abstract-exporter.mjs';
import { ItemExporter } from './item-exporter.mjs';
import { ActiveEffectExporter } from './active-effect-exporter.mjs';

export class ActorExporter extends AbstractExporter {
  static getDocumentData(document, customMapping, datasetMapping = {}) {
    const { name, type, prototypeToken: { name: tokenName } = {}, system } = document;
    const documentData = { ...name && { name } };

    if (name?.toLowerCase() !== tokenName?.toLowerCase()) documentData.tokenName = tokenName;
    if (system?.details?.biography?.value) documentData.description = system.details.biography.value;
    if (system?.attributes?.senses?.special) documentData.senses = system.attributes.senses.special;
    if (system?.attributes?.movement?.special) documentData.movement = system.attributes.movement.special;

    const keysToIgnore = ["system.details.type.subtype"];

    const localMapping = foundry.utils.deepClone(customMapping.Actor);

    let noAlignMapping = false;
    const hasAlignmentKey = localMapping.some(entry => entry.key === "alignment");
    if (!hasAlignmentKey) {
      const standardAlignments = new Set([
        "lawful good", "neutral good", "chaotic good",
        "lawful neutral", "neutral", "chaotic neutral",
        "lawful evil", "neutral evil", "chaotic evil",
        "unaligned"
      ]);

      const rawAlignment = document.system?.details?.alignment?.toLowerCase()?.trim();
      if (rawAlignment) {
        const isTypically = rawAlignment.startsWith("typically");
        const normalized = isTypically ? rawAlignment.slice("typically".length).trim() : rawAlignment;

        if (!standardAlignments.has(normalized)) {
          noAlignMapping = true;
          localMapping.push({
            key: "alignment",
            value: "system.details.alignment"
          });
        }
      }
    }
    
    const mappingAdded = this._addCustomMapping(localMapping, document, documentData, type === "character" ? keysToIgnore : []);

    if (noAlignMapping) delete mappingAdded.alignment;

    if (datasetMapping.Actor) {
      datasetMapping.Actor = foundry.utils.mergeObject(datasetMapping.Actor, mappingAdded);
    } else if (datasetMapping.actors) {
      datasetMapping.actors = foundry.utils.mergeObject(datasetMapping.actors, mappingAdded);
    } else {
      datasetMapping = foundry.utils.mergeObject(datasetMapping, mappingAdded);
    }

    if (this._hasContent(document.system.details?.habitat?.value)) {
      const planarSubtype = document.system.details.habitat.value.find(entry => entry.type === "planar" && entry.subtype)?.subtype;
      if (planarSubtype) documentData.planarSubtype = planarSubtype;
    }

    if (this._hasContent(document.items)) {
      document.items.filter(item => !item._tombstone).forEach(item => {
        documentData.items ??= {};
        const itemDoc = foundry.utils.duplicate(item);
        const itemData = ItemExporter.getDocumentData(itemDoc, customMapping, datasetMapping.Item ?? (datasetMapping.actors ? datasetMapping.items : {}));
        if (datasetMapping.Item) ItemExporter.addBaseMapping(datasetMapping.Item, itemDoc, itemData);
        const key = documentData.items[item.name] && !foundry.utils.equals(documentData.items[item.name], itemData) ? item._id : item.name;
        documentData.items[key] = itemData;
      });

      ItemExporter._reorderMapping(datasetMapping.Item ?? (datasetMapping.actors ? datasetMapping.items : {}));
    }

    const effectsData = ActiveEffectExporter.getEffectsData(
      document.effects, ActiveEffectExporter.ACTOR_CHANGES, ["dnd5eexhaustion0"]
    );
    if (effectsData) documentData.effects = effectsData;

    return documentData;
  }

  static addBaseMapping(mapping, document, documentData) {
    const { system, prototypeToken } = document;
    const { attributes = {}, traits = {}, details: { habitat } = {} } = system;
    const { movement, senses, travel, capacity } = attributes;
    const { languages: { communication } = {}, weight, keel, beam } = traits;

    const updateMapping = (field, condition, path, converter) => {
      if (!mapping[field] && condition) {
        mapping[field] = { path, converter };
      }
    };

    updateMapping('alignment', !mapping.alignment, 'system.details.alignment', 'alignment');

    const tokenLightCondition = !!(prototypeToken?.light?.bright || prototypeToken?.light?.dim);
    updateMapping('tokenLight', tokenLightCondition, 'prototypeToken.light', 'tokenLight');
    
    updateMapping('token', prototypeToken?.sight?.range, 'prototypeToken.sight.range', 'sightRange');

    const movementCondition = movement && ["ft", "mi"].includes(movement.units) &&
      (movement.burrow || movement.climb || movement.swim || movement.speed || movement.fly);
    updateMapping('movement', movementCondition, 'system.attributes.movement', 'movement');

    const sensesCondition = senses && ["ft", "mi"].includes(senses.units) && senses.ranges &&
      (senses.ranges.darkvision || senses.ranges.blindsight || senses.ranges.tremorsense || senses.ranges.truesight);
    updateMapping('senses', sensesCondition, 'system.attributes.senses', 'senses');

    const travelCondition = travel && travel.units === "mph" &&
      (travel.speeds?.air || travel.speeds?.land || travel.speeds?.water || travel.paces?.air || travel.paces?.land || travel.paces?.water);
    updateMapping('travel', travelCondition, 'system.attributes.travel', 'travel');

    if (weight && ["lb", "tn"].includes(weight.units) && weight.value) {
      updateMapping('weight', true, 'system.traits.weight', 'weight');
    }

    if (keel && ["ft", "mi"].includes(keel.units) && keel.value) {
      updateMapping('keel', true, 'system.traits.keel', 'range');
    }

    if (beam && ["ft", "mi"].includes(beam.units) && beam.value) {
      updateMapping('beam', true, 'system.traits.beam', 'range');
    }

    if (["lb", "tn"].includes(capacity?.cargo.units) && capacity.cargo.value) {
      updateMapping('capacityCargo', true, 'system.attributes.capacity.cargo', 'weight');
    }

    if (communication && typeof communication === "object") {
      Object.entries(communication).forEach(([, value]) => {
        if (["ft", "mi"].includes(value.units) && value.value) {
          updateMapping('communication', true, 'system.traits.languages.communication', "communication");
        }
      });
    }

    const planarSubtypeCondition = Array.isArray(habitat?.value) && habitat.value.some(entry => entry.type === "planar" && entry.subtype);
    updateMapping('planarSubtype', planarSubtypeCondition, 'system.details.habitat.value', 'planarSubtype');

    updateMapping('items', documentData.items, 'items', 'items');
    updateMapping('effects', documentData.effects, 'effects', 'effects');
  }

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const document = await this.pack.getDocument(indexDocument._id);

      const documentData = ActorExporter.getDocumentData(document.toObject(), this.options.mapping, this.dataset.mapping);

      ActorExporter.addBaseMapping(this.dataset.mapping.Actor ?? this.dataset.mapping, document, documentData);

      let key = this._getExportKey(document);
      key = this.dataset.entries[key] && !foundry.utils.equals(this.dataset.entries[key], documentData) ? document._id : key;

      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }

    ActorExporter._reorderMapping(this.dataset.mapping.Actor ?? this.dataset.mapping);
  }
}