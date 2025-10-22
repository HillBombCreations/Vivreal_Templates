import axios from 'axios';
const API_URL = process.env.NEXT_PUBLIC_CLIENT_API;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export const createReview = async (email: string, name: string, review: string, rating: number): Promise<boolean> => {
  try {
    await axios.post(
      `${API_URL}/tenant/definedCollectionObject`,
      {
          email: email,
          name: name,
          review: review,
          rating: rating,
          type: "createReview"
      },
      {
          headers: {
              Authorization: API_KEY,
              "Content-Type": "application/json",
          },
      }
    );
    return true;
  } catch (error) {
    console.error("Error fetching shows:", error);
    return false;
  }
};