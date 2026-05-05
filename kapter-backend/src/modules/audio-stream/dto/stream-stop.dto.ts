import { IsString } from 'class-validator';

export class StreamStopDto {
  @IsString()
  streamId!: string;
}
