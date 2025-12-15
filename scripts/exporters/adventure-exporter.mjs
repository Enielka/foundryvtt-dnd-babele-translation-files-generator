import { AbstractExporter } from './abstract-exporter.mjs';
import * as exporters from './_index.mjs';

export class AdventureExporter extends AbstractExporter {
  async _processDataset() {
    const avPackIndex = await this.pack.getIndex({
      fields: ['caption', 'scenes', 'macros', 'playlists', 'actors', 'items', 'tables', 'folders', 'journal', 'cards'],
    });

    avPackIndex.contents.forEach((avPack) => {
      this.progressTotalElements += avPack.scenes.length + avPack.macros.length + avPack.playlists.length
        + avPack.actors.length + avPack.items.length + avPack.tables.length + avPack.folders.length
        + avPack.journal.length + avPack.cards.length;
    });

    avPackIndex.contents.forEach((avPack) => {
      this.dataset.entries[avPack.name] = {
        name: avPack.name,
        description: avPack.description,
        caption: avPack.caption,
        scenes: {},
        macros: {},
        playlists: {},
        actors: {},
        items: {},
        tables: {},
        folders: {},
        journals: {},
        cards: {}
      };

      // Scenes
      for (const document of avPack.scenes) {
        const documentData = exporters.SceneExporter.getDocumentData(document, this.options.mapping, this.dataset.mapping);

        exporters.SceneExporter.addBaseMapping(this.dataset.mapping.Scene ?? this.dataset.mapping.scenes, document, documentData);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].scenes[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].scenes[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].scenes[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.scenes ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Macros
      for (const document of avPack.macros) {
        const documentData = exporters.MacroExporter.getDocumentData(document);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].macros[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].macros[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].macros[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.macros ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Playlists
      for (const document of avPack.playlists) {
        const documentData = exporters.PlaylistExporter.getDocumentData(document);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].playlists[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].playlists[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].playlists[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.playlists ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Actors
      for (const document of avPack.actors) {
        const documentData = exporters.ActorExporter.getDocumentData(document, this.options.mapping, this.dataset.mapping);

        exporters.ActorExporter.addBaseMapping(this.dataset.mapping.Actor ?? this.dataset.mapping.actors, document, documentData);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].actors[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].actors[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].actors[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.actors ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      exporters.ActorExporter._reorderMapping(this.dataset.mapping.Actor ?? this.dataset.mapping.actors);

      // Items
      for (const document of avPack.items) {
        const documentData = exporters.ItemExporter.getDocumentData(document, this.options.mapping.Item, this.dataset.mapping.Item ?? this.dataset.mapping.items);

        exporters.ItemExporter.addBaseMapping(this.dataset.mapping.Item ?? this.dataset.mapping.items, document, documentData);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].items[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].items[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].items[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.items ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      exporters.ItemExporter._reorderMapping(this.dataset.mapping.Item ?? this.dataset.mapping.items);

      // Tables
      for (const document of avPack.tables) {
        const documentData = exporters.RollTableExporter.getDocumentData(document, this.options.pillsByType.RollTable.rangeToInclude);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].tables[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].tables[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].tables[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.tables ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Folders
      for (const { name } of avPack.folders) {
        this.dataset.entries[avPack.name].folders[name] = (this.existingContent[avPack.name]?.folders ?? {})[name] ?? name;

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Journals
      for (const document of avPack.journal) {
        const documentData = exporters.JournalEntryExporter.getDocumentData(
          document,
          this.options.mapping.JournalEntry,
          this.dataset.mapping.JournalEntry ?? this.dataset.mapping.journals,
          this.options.pillsByType.JournalEntry.srcToInclude
        );

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].journals[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].journals[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].journals[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.journals ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Cards
      for (const document of avPack.cards) {
        const documentData = exporters.CardsExporter.getDocumentData(document);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].cards[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].cards[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].cards[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.cards ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Remove empty mapping
      for (const key in this.dataset.mapping) {
        if (Object.keys(this.dataset.mapping[key]).length === 0) delete this.dataset.mapping[key];
      }

      // Remove empty entries
      for (const key in this.dataset.entries[avPack.name]) {
        if (Object.keys(this.dataset.entries[avPack.name][key]).length === 0) {
          delete this.dataset.entries[avPack.name][key];
        }
      }
    });
  }
}