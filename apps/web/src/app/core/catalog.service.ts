import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CatalogItemDto, ItemDetailDto } from '@kanadrill/shared';
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
}
