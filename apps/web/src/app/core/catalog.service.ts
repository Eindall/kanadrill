import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { KANJI_PAGE_SIZE, type CatalogItemDto, type ItemDetailDto, type KanjiLevel, type KanjiLevelSummaryDto, type KanjiPageDto } from '@kanadrill/shared';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  loadCatalog(): Promise<CatalogItemDto[]> {
    return firstValueFrom(this.http.get<CatalogItemDto[]>('/api/catalog'));
  }

  loadItem(id: string): Promise<ItemDetailDto> {
    return firstValueFrom(this.http.get<ItemDetailDto>(`/api/catalog/${encodeURIComponent(id)}`));
  }

  loadKanjiLevels(): Promise<KanjiLevelSummaryDto[]> {
    return firstValueFrom(this.http.get<KanjiLevelSummaryDto[]>('/api/kanji/levels'));
  }

  /** Une page de kanji d'un niveau, éventuellement filtrée par une recherche (caractères, sens ou lecture). */
  loadKanji(options: { level?: KanjiLevel; q?: string; offset?: number; limit?: number }): Promise<KanjiPageDto> {
    let params = new HttpParams().set('limit', options.limit ?? KANJI_PAGE_SIZE).set('offset', options.offset ?? 0);
    if (options.level) params = params.set('level', options.level);
    if (options.q?.trim()) params = params.set('q', options.q.trim());
    return firstValueFrom(this.http.get<KanjiPageDto>('/api/kanji', { params }));
  }

  /** Dictionnaire perso : ajoute des kanji (les kana y sont d'office) ; renvoie le nombre réellement ajouté. */
  async addToDictionary(itemIds: string[]): Promise<number> {
    return (await firstValueFrom(this.http.post<{ added: number }>('/api/dictionary', { itemIds }))).added;
  }

  async addLevelToDictionary(level: KanjiLevel): Promise<number> {
    return (await firstValueFrom(this.http.post<{ added: number }>(`/api/dictionary/levels/${level}`, {}))).added;
  }

  removeFromDictionary(itemId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/dictionary/${encodeURIComponent(itemId)}`));
  }
}
