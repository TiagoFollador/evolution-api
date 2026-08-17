import { RouterBroker } from '@api/abstract/abstract.router';
import { metaSignatureGuard, secretEquals } from '@api/guards/meta-signature.guard';
import { metaController } from '@api/server.module';
import { ConfigService, WaBusiness } from '@config/env.config';
import { Router } from 'express';

export class MetaRouter extends RouterBroker {
  constructor(readonly configService: ConfigService) {
    super();
    this.router
      .get(this.routerPath('webhook/meta', false), async (req, res) => {
        const { TOKEN_WEBHOOK } = configService.get<WaBusiness>('WA_BUSINESS');

        // A Meta só considera a subscription verificada quando o challenge volta
        // com 200. Responder 200 no caminho de falha — como fazia antes — deixa
        // uma callback URL com token errado passar por verificada.
        if (
          req.query['hub.mode'] !== 'subscribe' ||
          !secretEquals(req.query['hub.verify_token'] as string, TOKEN_WEBHOOK)
        ) {
          return res.status(403).json({ status: 403, error: 'Forbidden' });
        }

        return res.send(req.query['hub.challenge']);
      })
      .post(this.routerPath('webhook/meta', false), metaSignatureGuard, async (req, res) => {
        const { body } = req;
        const response = await metaController.receiveWebhook(body);

        return res.status(200).json(response);
      });
  }

  public readonly router: Router = Router();
}
