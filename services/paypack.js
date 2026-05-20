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
    if (this.accessToken && this.tokenExpiryTime && new Date() < this.tokenExpiryTime) {
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
      this.tokenExpiryTime = new Date(Date.now() + 45 * 60 * 1000);
      return this.accessToken;
    } catch (error) {
      console.error("PayPack Authentication Error:", error.response?.data || error.message);
      throw new Error("PayPack authentication failed");
    }
  }

  async initiateCashin(phoneNumber, amount) {
    const token = await this.getAccessToken();
    try {
      const response = await axios.post(
        `${this.baseUrl}/transactions/cashin`,
        { amount, number: phoneNumber },
        { headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error) {
      console.error("PayPack Cashin Error:", error.response?.data || error.message);
      throw error;
    }
  }

  async checkPaymentStatus(transactionRef) {
    const token = await this.getAccessToken();
    try {
      // Use the specific transaction find endpoint which is more reliable than general events
      const response = await axios.get(`${this.baseUrl}/transactions/find/${transactionRef}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        timeout: 10000,
      });

      // PayPack's find endpoint returns the specific transaction object
      const transaction = response.data;
      if (!transaction) return { status: "pending", eventKind: null };

      // Map PayPack status to our internal status
      // Possible statuses: 'successful', 'failed', 'expired', 'pending'
      return { 
        status: transaction.status, 
        amount: transaction.amount,
        kind: transaction.kind 
      };
    } catch (error) {
      // If 404 is returned, it might mean it's still pending or hasn't been indexed yet
      if (error.response?.status === 404) {
        return { status: "pending" };
      }
      console.error("PayPack Status Check Error:", error.response?.data || error.message);
      return { status: "error", message: error.message };
    }
  }
}

module.exports = new PaypackService();
