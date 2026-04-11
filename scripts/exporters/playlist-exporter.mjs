import { AbstractExporter } from './abstract-exporter.mjs';

export class PlaylistExporter extends AbstractExporter {
  static getDocumentData(document) {
    const { name, description } = document;
    const documentData = { name, ...(description && { description }) };

    if (this._hasContent(document.sounds)) {
      documentData.sounds = Object.fromEntries(
        document.sounds.map(sound => [sound.name, sound])
      );
    }

    return documentData;
  }

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const documentData = PlaylistExporter.getDocumentData(await this.pack.getDocument(indexDocument._id));

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.equals(this.dataset.entries[key], documentData) ? indexDocument._id : key;

      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}