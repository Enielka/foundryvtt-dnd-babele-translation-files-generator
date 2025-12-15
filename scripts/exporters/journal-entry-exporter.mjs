import { AbstractExporter } from './abstract-exporter.mjs';

export class JournalEntryExporter extends AbstractExporter {
  static getDocumentData(document, customMapping, datasetMapping, srcToInclude) {
    const documentData = { name: document.name };

    const mappingAdded = this._addCustomMapping(customMapping, document, documentData);

    datasetMapping = foundry.utils.mergeObject(datasetMapping, mappingAdded);

    if (this._hasContent(document.categories)) {
      documentData.categories = Object.fromEntries(
        document.categories.map(cat => [cat.name, cat.name])
      );
    }

    if (this._hasContent(document.pages)) {
        const pageTracker = new Set();

        documentData.pages = Object.fromEntries(
            document.pages.map(({ 
                id, 
                name, 
                image: { caption } = {}, 
                src, 
                video: { width, height } = {}, 
                text: { content: text } = {}, 
                system: {
                    tooltip,
                    subclassHeader,
                    unlinkedSpells,
                    description: {
                        value: description,
                        additionalEquipment,
                        additionalHitPoints,
                        additionalTraits,
                        subclass
                    } = {}
                } = {}, 
                flags: { dnd5e: { title: flagsTitle } = {} } = {}
            }) => {
                const uniqueName = pageTracker.has(name) ? id : name;
                pageTracker.add(name);
                const srcIncluded = (srcToInclude.includes(name) || srcToInclude.includes(id));
                return [
                    uniqueName,
                    {
                        name,
                        ...(caption && { caption }),
                        ...(srcIncluded && src && { src }),
                        ...(width && { width }),
                        ...(height && { height }),
                        ...(text && { text }),
                        ...(tooltip && { tooltip }),
                        ...(subclassHeader && { subclassHeader }),
                        ...(description && { description }),
                        ...(additionalEquipment && { additionalEquipment }),
                        ...(additionalHitPoints && { additionalHitPoints }),
                        ...(additionalTraits && { additionalTraits }),
                        ...(subclass && { subclass }),
                        ...(flagsTitle && { flagsTitle }),
                        ...(unlinkedSpells && Object.keys(unlinkedSpells).length > 0 && {
                            unlinkedSpells: Object.fromEntries(Object.entries(unlinkedSpells).map(
                              ([key, value]) => [value.name, { name: value.name }]))
                        })
                    }
                ];
            })
        );
    }

    return documentData;
}

  async _processDataset() {
    const documents = await this.pack.getIndex();

    for (const indexDocument of documents) {
      const documentData = JournalEntryExporter.getDocumentData(
        await this.pack.getDocument(indexDocument._id),
        this.options.mapping.JournalEntry,
        this.dataset.mapping.JournalEntry ?? this.dataset.mapping,
        this.options.pillsByType.JournalEntry.srcToInclude
      );

      let key = this._getExportKey(indexDocument);
      key = this.dataset.entries[key] && !foundry.utils.objectsEqual(this.dataset.entries[key], documentData) ? indexDocument._id : key;
      
      this.dataset.entries[key] = foundry.utils.mergeObject(documentData, this.existingContent[key] ?? {});

      if (!this.options.asZip) this._stepProgressBar();
    }
  }
}