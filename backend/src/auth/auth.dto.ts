import { IsEmail, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80) name: string;
  @Transform(trim) @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(8) @MaxLength(72) // bcrypt only uses the first 72 bytes
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'password must contain a letter and a number' })
  password: string;
}
export class LoginDto {
  @Transform(trim) @IsEmail() email: string;
  @IsString() @MaxLength(72) password: string;
}
