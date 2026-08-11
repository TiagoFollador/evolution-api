import { ConfigService, Language, Openai as OpenaiConfig } from '@config/env.config';
import { Logger } from '@config/logger.config';
import axios from 'axios';
import FormData from 'form-data';

export type TranscriptionCredential = {
  apiKey?: string | null;
};

/** Where to read the audio from. Exactly one of the two is required. */
export type TranscriptionSource = {
  mediaUrl?: string | null;
  base64?: string | null;
};

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

/**
 * Voice-note transcription, extracted from the OpenAI chatbot integration so
 * the Meta channel keeps working after that integration is deleted.
 *
 * The original took a Baileys message and fell back to `downloadMediaMessage`
 * when it carried no URL. This takes a URL or a base64 payload instead: every
 * Meta channel has one or the other by the time transcription runs, and the
 * Baileys download path no longer exists.
 */
export class TranscriptionService {
  private readonly logger = new Logger('TranscriptionService');

  constructor(private readonly configService: ConfigService) {}

  public async transcribe(credential: TranscriptionCredential, source: TranscriptionSource): Promise<string | null> {
    const apiKey = credential?.apiKey || this.configService.get<OpenaiConfig>('OPENAI').API_KEY_GLOBAL;

    if (!apiKey) {
      this.logger.error('No transcription API key configured');
      return null;
    }

    const audio = await this.loadAudio(source);

    if (!audio) {
      this.logger.error('Transcription source carried neither mediaUrl nor base64');
      return null;
    }

    const configuredLanguage = this.configService.get<Language>('LANGUAGE');
    const language = configuredLanguage.includes('pt') ? 'pt' : configuredLanguage;

    const formData = new FormData();
    formData.append('file', audio, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', language);

    const response = await axios.post(WHISPER_ENDPOINT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response?.data?.text ?? null;
  }

  private async loadAudio(source: TranscriptionSource): Promise<Buffer | null> {
    if (source?.mediaUrl) {
      const response = await axios.get(source.mediaUrl, { responseType: 'arraybuffer' });
      return Buffer.from(response.data, 'binary');
    }

    if (source?.base64) {
      return Buffer.from(source.base64, 'base64');
    }

    return null;
  }
}
