import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FreeboxConfig, RecordRequest } from './freebox.interface';

const CACHE_DIR = path.join(process.cwd(), 'cache');
const CONFIG_FILE = path.join(CACHE_DIR, 'freebox_config.json');
const FREEBOX_API_URL = 'http://mafreebox.freebox.fr/api/v8';

const APP_CONFIG = {
  app_id: 'fr.cine.tvrecorder',
  app_name: 'Ciné TV Recorder',
  app_version: '2.0.0',
  device_name: 'Ciné App',
};

@Injectable()
export class FreeboxService {
  private readonly logger = new Logger(FreeboxService.name);

  constructor() {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  }

  private loadConfig(): FreeboxConfig | null {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      }
    } catch (error) {
      this.logger.error('Erreur lecture config:', error);
    }
    return null;
  }

  private saveConfig(config: FreeboxConfig): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  }

  private computeHmac(challenge: string, appToken: string): string {
    return crypto.createHmac('sha1', appToken).update(challenge).digest('hex');
  }

  private async freeboxApi(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    sessionToken?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['X-Fbx-App-Auth'] = sessionToken;
    }

    const response = await fetch(`${FREEBOX_API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return response.json();
  }

  async authorize(): Promise<{ success: boolean; message?: string; error?: string; trackId?: number }> {
    this.logger.log('📱 Demande d\'autorisation Freebox...');

    try {
      const response = await this.freeboxApi('/login/authorize/', 'POST', APP_CONFIG);

      if (response.success) {
        const config: FreeboxConfig = {
          appToken: response.result.app_token,
          trackId: response.result.track_id,
        };
        this.saveConfig(config);

        this.logger.log('✅ Autorisation demandée');
        return {
          success: true,
          message: 'Veuillez valider sur l\'écran LCD de votre Freebox',
          trackId: response.result.track_id,
        };
      }

      return { success: false, error: response.msg || 'Erreur d\'autorisation' };
    } catch (error) {
      this.logger.error('❌ Erreur:', error);
      return { success: false, error: String(error) };
    }
  }

  async checkAuthorizationStatus(): Promise<{ success: boolean; status?: string; message?: string }> {
    const config = this.loadConfig();
    if (!config?.trackId) {
      return { success: false, message: 'Aucune autorisation en cours' };
    }

    try {
      const response = await this.freeboxApi(`/login/authorize/${config.trackId}`);

      if (response.success) {
        const status = response.result.status;
        this.logger.log(`📊 Statut: ${status}`);

        const messages: Record<string, string> = {
          granted: 'Autorisation accordée!',
          pending: 'En attente de validation...',
          denied: 'Autorisation refusée',
          timeout: 'Délai dépassé',
        };

        return {
          success: status === 'granted' || status === 'pending',
          status,
          message: messages[status] || `Statut: ${status}`,
        };
      }

      return { success: false, message: response.msg };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  }

  private async openSession(): Promise<string | null> {
    const config = this.loadConfig();
    if (!config?.appToken) {
      this.logger.error('❌ Pas de token');
      return null;
    }

    try {
      const loginResponse = await this.freeboxApi('/login/');
      if (!loginResponse.success) {
        this.logger.error('❌ Erreur login:', loginResponse.msg);
        return null;
      }

      const challenge = loginResponse.result.challenge;
      const password = this.computeHmac(challenge, config.appToken);

      const sessionResponse = await this.freeboxApi('/login/session/', 'POST', {
        app_id: APP_CONFIG.app_id,
        password,
      });

      if (sessionResponse.success) {
        config.sessionToken = sessionResponse.result.session_token;
        this.saveConfig(config);
        return sessionResponse.result.session_token;
      }

      this.logger.error('❌ Erreur session:', sessionResponse.msg);
      return null;
    } catch (error) {
      this.logger.error('❌ Erreur:', error);
      return null;
    }
  }

  async getStatus(): Promise<{ success: boolean; connected: boolean; message?: string }> {
    const config = this.loadConfig();

    if (!config?.appToken) {
      return {
        success: true,
        connected: false,
        message: 'Non configuré',
      };
    }

    try {
      const sessionToken = await this.openSession();
      return {
        success: true,
        connected: !!sessionToken,
        message: sessionToken ? 'Connecté' : 'Échec de connexion',
      };
    } catch (error) {
      return { success: false, connected: false, message: String(error) };
    }
  }

  async getChannels(): Promise<{ success: boolean; channels?: any; error?: string }> {
    try {
      const sessionToken = await this.openSession();
      if (!sessionToken) {
        return { success: false, error: 'Non connecté' };
      }

      const response = await this.freeboxApi('/tv/channels/', 'GET', undefined, sessionToken);
      return response.success
        ? { success: true, channels: response.result }
        : { success: false, error: response.msg };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async record(request: RecordRequest): Promise<{ success: boolean; message?: string; error?: string; recordId?: number }> {
    this.logger.log(`🎬 Enregistrement: ${request.name} sur ${request.channelName}`);

    try {
      const sessionToken = await this.openSession();
      if (!sessionToken) {
        return { success: false, error: 'Non connecté à la Freebox' };
      }

      // Récupérer les chaînes
      const channelsResponse = await this.freeboxApi('/tv/channels/', 'GET', undefined, sessionToken);
      if (!channelsResponse.success) {
        return { success: false, error: 'Impossible de récupérer les chaînes' };
      }

      // Trouver la chaîne
      const channels = Object.values(channelsResponse.result) as any[];
      const channel = channels.find((ch: any) =>
        ch.name.toLowerCase().includes(request.channelName.toLowerCase().replace('.fr', '')) ||
        request.channelName.toLowerCase().includes(ch.name.toLowerCase())
      );

      if (!channel) {
        return { success: false, error: `Chaîne "${request.channelName}" non trouvée` };
      }

      this.logger.log(`📺 Chaîne trouvée: ${channel.name}`);

      // Programmer l'enregistrement avec marges (5mn avant, 15mn après)
      const recordRequest = {
        channel_uuid: channel.uuid,
        start: request.start,
        end: request.end,
        name: request.name,
        margin_before: 5 * 60,
        margin_after: 25 * 60,
        channel_quality: 'hd'
      };

      const recordResponse = await this.freeboxApi('/pvr/programmed/', 'POST', recordRequest, sessionToken);

      if (recordResponse.success) {
        this.logger.log('✅ Enregistrement programmé!');
        return {
          success: true,
          message: `Enregistrement programmé: ${request.name}`,
          recordId: recordResponse.result.id,
        };
      }

      return { success: false, error: recordResponse.msg || 'Erreur de programmation' };
    } catch (error) {
      this.logger.error('❌ Erreur:', error);
      return { success: false, error: String(error) };
    }
  }

  async getRecordings(): Promise<{ success: boolean; recordings?: any; error?: string }> {
    try {
      const sessionToken = await this.openSession();
      if (!sessionToken) {
        return { success: false, error: 'Non connecté' };
      }

      const response = await this.freeboxApi('/pvr/programmed/', 'GET', undefined, sessionToken);
      return response.success
        ? { success: true, recordings: response.result }
        : { success: false, error: response.msg };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}

