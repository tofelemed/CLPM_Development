import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // For development, use a simple secret if JWKS is not configured
    const jwksUri = process.env.OIDC_JWKS_URI;
    
    if (!jwksUri) {
      console.warn('OIDC_JWKS_URI not configured, using development mode with simple secret');
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: 'dev-secret-key-change-in-production',
        algorithms: ['HS256']
      });
    } else {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        audience: process.env.OIDC_AUDIENCE,
        issuer: process.env.OIDC_ISSUER,
        algorithms: ['RS256'],
        secretOrKeyProvider: jwksRsa.passportJwtSecret({
          cache: true,
          cacheMaxEntries: 5,
          cacheMaxAge: 600000,
          jwksUri: jwksUri
        })
      });
    }
  }

  async validate(payload: any) {
    const roles = (payload.realm_access?.roles || payload.resource_access?.['clpm-api']?.roles || []) as string[];
    return { sub: payload.sub, roles };
  }
}
