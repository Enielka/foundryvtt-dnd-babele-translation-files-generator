import { AbstractExporter } from './abstract-exporter.mjs';
import { ActorExporter } from './actor-exporter.mjs';

export class SceneExporter extends AbstractExporter {
  static getDocumentData(document, customMapping) {
    const documentData = { name: document.name };

    this._addCustomMapping(customMapping.Scene, document, documentData);

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
      for (const { _id, name: tokenName, delta } of document.tokens) {
        const deltaToken = ActorExporter.getDocumentData(delta, customMapping, true);
        if (Object.keys(deltaToken).length) {
          documentData.deltaTokens = documentData.deltaTokens ?? {};
          const key = documentData.deltaTokens[tokenName] && !foundry.utils.objectsEqual(documentData.deltaTokens[tokenName], deltaToken) ? _id : tokenName;
          documentData.deltaTokens[key] = deltaToken;
        }
      }
    }
    
    return documentData;
  }

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const documentData = SceneExporter.getDocumentData(
        await this.pack.getDocument(indexDocument._id),
        this.options.mapping
      );

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.objectsEqual(this.dataset.entries[key], documentData) ? indexDocument._id : key;

      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}
