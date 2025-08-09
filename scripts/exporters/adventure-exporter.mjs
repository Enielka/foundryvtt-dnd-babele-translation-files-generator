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
        const documentData = exporters.SceneExporter.getDocumentData(document, this.options.mapping);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].scenes[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].scenes[key], documentData) ? document._id : key;

        if (documentData.deltaTokens) {
          this.dataset.mapping.scenes ??= {};
          this.dataset.mapping.scenes.deltaTokens ??= { path: "tokens", converter: "tokens" };
        }

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
        const documentData = exporters.ActorExporter.getDocumentData(document, this.options.mapping);

        exporters.ActorExporter.addBaseMapping(this.dataset.mapping.actors ?? {}, document, documentData);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].actors[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].actors[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].actors[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.actors ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Items
      for (const document of avPack.items) {
        const documentData = exporters.ItemExporter.getDocumentData(document, this.options.mapping.Item);

        exporters.ItemExporter.addBaseMapping(this.dataset.mapping.items ?? {}, document, documentData);

        let key = this._getExportKey(document);
        key = this.dataset.entries[avPack.name].items[key] && !foundry.utils.objectsEqual(this.dataset.entries[avPack.name].items[key], documentData) ? document._id : key;

        this.dataset.entries[avPack.name].items[key] = foundry.utils.mergeObject(documentData, (this.existingContent[avPack.name]?.items ?? {})[key] ?? {});

        if (!this.options.asZip) this._stepProgressBar();
      }

      // Tables
      for (const document of avPack.tables) {
        const documentData = exporters.RollTableExporter.getDocumentData(document);

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
        const documentData = exporters.JournalEntryExporter.getDocumentData(document, this.options.mapping);

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

      // Remove empty collections
      for (const key in this.dataset.entries[avPack.name]) {
        if (0 === Object.keys(this.dataset.entries[avPack.name][key]).length) {
          delete this.dataset.entries[avPack.name][key];
        }
      }
    });
  }
}