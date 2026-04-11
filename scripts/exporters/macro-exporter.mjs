import { AbstractExporter } from './abstract-exporter.mjs';

export class MacroExporter extends AbstractExporter {
  static getDocumentData(document) {
    const { name, command } = document;

    return { name, command };
  }

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const documentData = MacroExporter.getDocumentData(indexDocument);

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.equals(this.dataset.entries[key], documentData) ? indexDocument._id : key;
      
      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}