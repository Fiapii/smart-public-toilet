const axios = require('axios');

class PaypackService {
  constructor() {
    this.baseUrl = process.env.PAYPACK_BASE_URL || "https://payments.paypack.rw/api";
    this.clientId = process.env.PAYPACK_CLIENT_ID;
    this.clientSecret = process.env.PAYPACK_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiryTime = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiryTime && Date.now() + 120000 < this.tokenExpiryTime) {
      return this.accessToken;
    }

    const webhookMode = process.env.NODE_ENV === "production" ? "production" : "development";

    try {
      const response = await axios.post(
        `${this.baseUrl}/auth/agents/authorize`,
        { client_id: this.clientId, client_secret: this.clientSecret },
        { headers: { "Content-Type": "application/json", "X-Webhook-Mode": webhookMode } }
      );

      if (!response.data?.access) throw new Error("Failed to obtain access token from PayPack");

      this.accessToken = response.data.access;
      const expiresIn = (response.data.expires_in || 45 * 60) * 1000;
      this.tokenExpiryTime = Date.now() + expiresIn - 60000;
      console.log(`PayPack token refreshed, expires in ${expiresIn / 1000} seconds`);
      return this.accessToken;
    } catch (error) {
      console.error("PayPack Authentication Error:", error.response?.data || error.message);
      throw new Error("PayPack authentication failed");
    }
  }

  async _requestWithRetry(method, url, data = null, headers = {}) {
    const token = await this.getAccessToken();
    const config = {
      method,
      url,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...headers
      },
      data
    };

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log("Token expired, refreshing...");
        this.accessToken = null;
        this.tokenExpiryTime = null;
        const newToken = await this.getAccessToken();
        config.headers.Authorization = `Bearer ${newToken}`;
        const retryResponse = await axios(config);
        return retryResponse.data;
      }
      throw error;
    }
  }

  async initiateCashin(phoneNumber, amount) {
    try {
      const data = await this._requestWithRetry(
        "post",
        `${this.baseUrl}/transactions/cashin`,
        { amount, number: phoneNumber }
      );
      return data;
    } catch (error) {
      console.error("PayPack Cashin Error:", error.response?.data || error.message);
      throw error;
    }
  }

  async checkPaymentStatus(transactionRef) {
    try {
      const data = await this._requestWithRetry(
        "get",
        `${this.baseUrl}/transactions/find/${transactionRef}`
      );
      if (!data) return { status: "pending", eventKind: null };
      
      // Normalise status (case‑insensitive, map variations)
      let rawStatus = (data.status || "").toString().toLowerCase().trim();
      let mappedStatus = "pending";
      if (rawStatus === "successful" || rawStatus === "success" || rawStatus === "completed") {
        mappedStatus = "successful";
      } else if (rawStatus === "failed" || rawStatus === "expired") {
        mappedStatus = "failed";
      }
      
      return {
        status: mappedStatus,
        amount: data.amount,
        kind: data.kind
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return { status: "pending" };
      }
      console.error("PayPack Status Check Error:", error.response?.data || error.message);
      return { status: "error", message: error.message };
    }
  }
}

module.exports = new PaypackService();