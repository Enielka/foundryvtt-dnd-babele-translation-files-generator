import { AbstractExporter } from './abstract-exporter.mjs';

export class ActiveEffectExporter extends AbstractExporter {
  static DEFAULT_CHANGES = [
    'name',
    'system.description.value',
    'system.details.alignment',
    'system.range.special',
    'system.target.affects.special',
    'system.attributes.senses.special',
    'system.attributes.movement.special'
  ];

  static ACTOR_CHANGES = ['name', 'system.description.value'];

  static _isTranslatableChange(key, allowedChanges) {
    if (allowedChanges.includes(key)) return true;

    return /(^|\.)activities[[.]/.test(key) && (
      key.endsWith('.name') || key.endsWith('.roll.name') || key.endsWith('.activation.condition') ||
      key.endsWith('.description.chatFlavor') || key.endsWith('.duration.special') ||
      key.endsWith('.range.special') || key.endsWith('.target.affects.special')
    );
  }

  static getEffectsData(effects, allowedChanges = this.DEFAULT_CHANGES, idsToIgnore = []) {
    if (!this._hasContent(effects)) return null;

    const effectsData = {};

    effects
      .filter(effect => !idsToIgnore.includes(effect._id) && !effect._tombstone)
      .forEach(effect => {
        const effectData = this.getDocumentData(effect, allowedChanges);

        const key = effectsData[effect.name] && !foundry.utils.equals(effectsData[effect.name], effectData)
          ? effect._id : effect.name;
        effectsData[key] = effectData;
      });

    return Object.keys(effectsData).length ? effectsData : null;
  }

  static getDocumentData(document, allowedChanges = this.DEFAULT_CHANGES) {
    const { name, description } = document;
    const documentData = { name, ...(description && { description }) };

    const changes = document.system?.changes ?? document.changes;

    if (Array.isArray(changes) && changes.length) {
      const changesObj = changes.reduce((acc, change, index) => {
        if (this._isTranslatableChange(change.key, allowedChanges)) acc[index] = change.value;
        if (change.value?.condition || change.value?.special || change.value?.affects?.special) {
          acc[index] = JSON.stringify(change.value);
        }

        return acc;
      }, {});

      if (Object.keys(changesObj).length) documentData.changes = changesObj;
    }

    return documentData;
  }

  async _processDataset() {
    const documents = await this.pack.getIndex({ fields: ['description', 'changes', 'system.changes'] });

    for (const indexDocument of documents) {
      const documentData = ActiveEffectExporter.getDocumentData(indexDocument);

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.equals(this.dataset.entries[key], documentData) ? indexDocument._id : key;

      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}
