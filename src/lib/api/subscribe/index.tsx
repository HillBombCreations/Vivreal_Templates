import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_CLIENT_API;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export const subscribeUser = async (email: string): Promise<boolean> => {
  try {
    await axios.post(
        `${API_URL}/tenant/subscribeUser`,
        { email },
        {
            headers: {
                Authorization: API_KEY,
                "Content-Type": "application/json",
            }
        }
    );
    return true;
  } catch (error) {
    console.error("Error fetching shows:", error);
    return false;
  }
};