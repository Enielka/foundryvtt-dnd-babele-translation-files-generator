import { AbstractExporter } from './abstract-exporter.mjs';

export class RollTableExporter extends AbstractExporter {
  static getDocumentData(document, rangeToInclude) {
    const { name, description } = document;
    const documentData = { name, ...(description && { description }) };

    const rangeIncluded = (rangeToInclude.includes(name) || rangeToInclude.includes(document._id));

    if (this._hasContent(document.results)) {
      const rangeCount = new Map();

      document.results.forEach(res => {
        const range = `${res.range[0]}-${res.range[1]}`;
        rangeCount.set(range, (rangeCount.get(range) || 0) + 1);
      });

      documentData.results = Object.fromEntries(
        document.results.map(({ _id, name, type, range, description }) => {
          const rangeStr = `${range[0]}-${range[1]}`;
          const uniqueKey = rangeCount.get(rangeStr) > 1 ? _id : rangeStr;

          const entry = {};
          if (type !== "document" && name?.length) entry.name = name;
          if (description) entry.description = description;
          if (rangeIncluded) entry.range = { "0": range[0], "1": range[1] };

          const onlyDescription = Object.keys(entry).length === 1 && entry.description;
          return onlyDescription ? [uniqueKey, entry.description] : Object.keys(entry).length ? [uniqueKey, entry] : null;
        }).filter(Boolean)
      );
    }

    if (Object.keys(documentData.results).length === 0) delete documentData.results;

    return documentData;
  }

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const documentData = RollTableExporter.getDocumentData(
        await this.pack.getDocument(indexDocument._id),
        this.options.pillsByType.RollTable.rangeToInclude
      );

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.objectsEqual(this.dataset.entries[key], documentData) ? indexDocument._id : key;

      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}