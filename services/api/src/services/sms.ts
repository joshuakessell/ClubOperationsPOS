export interface SmsProvider {
  sendSms(toE164: string, body: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async sendSms(toE164: string, body: string): Promise<void> {
    console.log(`[SMS][console] to=${toE164}: ${body}`);
  }
}

class TwilioSmsProvider implements SmsProvider {
  constructor(
    private accountSid: string,
    private authToken: string,
    private fromNumber: string,
  ) {}

  async sendSms(toE164: string, body: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const payload = new URLSearchParams({
      To: toE164,
      From: this.fromNumber,
      Body: body,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Twilio SMS failed (${response.status}): ${text}`);
    }
  }
}

let providerInstance: SmsProvider | null = null;

function getProvider(): SmsProvider {
  if (providerInstance) return providerInstance;

  const provider = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  if (provider === 'twilio') {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn('Twilio SMS provider selected but configuration missing. Falling back to console provider.');
      providerInstance = new ConsoleSmsProvider();
      return providerInstance;
    }

    providerInstance = new TwilioSmsProvider(accountSid, authToken, fromNumber);
    return providerInstance;
  }

  providerInstance = new ConsoleSmsProvider();
  return providerInstance;
}

export async function sendSms(toE164: string, body: string): Promise<void> {
  const provider = getProvider();
  await provider.sendSms(toE164, body);
}

