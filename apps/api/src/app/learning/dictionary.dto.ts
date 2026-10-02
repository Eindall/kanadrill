import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import { MAX_DICTIONARY_BATCH } from '@kanadrill/shared';

export class AddToDictionaryDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_DICTIONARY_BATCH)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  itemIds!: string[];
}
