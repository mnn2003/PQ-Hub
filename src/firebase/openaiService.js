import axios from 'axios';

const API_KEY = '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'; // Replace with your actual OpenAI API key
const API_URL = 'https://api.openai.com/v1/chat/completions';

const MAX_RETRIES = 5;

export const askAIChatbot = async (message, retries = 0) => {
  const body = {
    model: 'gpt-3.5-turbo', // or any other model you're using
    messages: [{ role: 'user', content: message }],
  };

  try {
    const response = await axios.post(API_URL, body, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data.choices[0].message.content; // Extracting the AI's response
  } catch (error) {
    if (error.response && error.response.status === 429 && retries < MAX_RETRIES) {
      const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return askAIChatbot(message, retries + 1); // Retry the request
    }
    console.error('Error with OpenAI API:', error);
    throw error; // Rethrow error for handling in the component
  }
};
