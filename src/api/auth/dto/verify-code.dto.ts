import { IsEmail, IsNotEmpty, Length, MaxLength } from 'class-validator';

export class VerifyCodeDto {
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}
