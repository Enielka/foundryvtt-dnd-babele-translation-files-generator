import { AbstractExporter } from './abstract-exporter.mjs';
import { ActorExporter } from './actor-exporter.mjs';

export class SceneExporter extends AbstractExporter {
  static getDocumentData(document, customMapping, datasetMapping) {
    const documentData = { name: document.name };

    const mappingAdded = this._addCustomMapping(customMapping.Scene, document, documentData);

    if (datasetMapping.Scene) {
      datasetMapping.Scene = foundry.utils.mergeObject(datasetMapping.Scene, mappingAdded);
    } else if (datasetMapping.scenes) {
      datasetMapping.scenes = foundry.utils.mergeObject(datasetMapping.scenes, mappingAdded);
    } else {
      datasetMapping = foundry.utils.mergeObject(datasetMapping, mappingAdded);
    }

    if (this._hasContent(document.drawings)) {
      documentData.drawings = Object.fromEntries(
        document.drawings
        .filter(({ text }) => text.length)
        .map(({ text }) => [text, text])
      );
    }

    if (this._hasContent(document.notes)) {
      for (const { text } of document.notes) {
        if (text.length) {
          documentData.notes = documentData.notes ?? {};
          documentData.notes[text] = text;
        }
      }
    }

    if (this._hasContent(document.tokens)) {
      for (const { _id, name: tokenName, delta, actorId } of document.tokens) {
        const deltaToken = ActorExporter.getDocumentData(delta, customMapping);
        ActorExporter.addBaseMapping(datasetMapping.Actor, delta, deltaToken);
        const actor = game.actors.get(actorId);
        if (actor?.prototypeToken.name !== tokenName && !deltaToken.name) deltaToken.name = tokenName;
        if (Object.keys(deltaToken).length) {
          documentData.deltaTokens = documentData.deltaTokens ?? {};
          const key = documentData.deltaTokens[tokenName] && !foundry.utils.objectsEqual(documentData.deltaTokens[tokenName], deltaToken) ? _id : tokenName;
          documentData.deltaTokens[key] = deltaToken;
        }
      }
    }
    
    return documentData;
  }

  static addBaseMapping(mapping, document, documentData) {
    const { grid } = document;

    const updateMapping = (field, condition, path, converter) => {
      if (!mapping[field] && condition) {
        mapping[field] = { path, converter };
      }
    };

    const gridCondition = grid && ["ft", "mi"].includes(grid.units) && grid.distance;
    updateMapping('grid', gridCondition, 'grid', 'grid');

    updateMapping('deltaTokens', documentData.deltaTokens, 'tokens', 'tokens');
  }

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const document = await this.pack.getDocument(indexDocument._id);
      
      const documentData = SceneExporter.getDocumentData(document, this.options.mapping, this.dataset.mapping.Scene ?? this.dataset.mapping);

      SceneExporter.addBaseMapping(this.dataset.mapping.Scene ?? this.dataset.mapping, document, documentData);

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.objectsEqual(this.dataset.entries[key], documentData) ? indexDocument._id : key;

      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}