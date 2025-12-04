import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class RequestCodeDto {
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
