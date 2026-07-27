import React, { useState, useEffect } from 'react';

interface DrawItem {
  id: number;
  title: string;
  url: string;
  winner: string;
  date: string;
}

export default function FacebookPicker() {
  const [title, setTitle] = useState('');
  const [postUrl, setPostUrl] = useState('');
  const [winner, setWinner] = useState('');
  const [draws, setDraws] = useState<DrawItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDraws();
  }, []);

  const fetchDraws = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/draws');
      const data = await res.json();
      setDraws(data);
    } catch (err) {
      console.error('Failed to load past draws');
    }
  };

  const handlePickWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setWinner('');

    try {
      const response = await fetch('http://localhost:5000/api/pick-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url: postUrl })
      });

      const data = await response.json();
      if (response.ok) {
        setWinner(data.winner);
        setTitle('');
        setPostUrl('');
        fetchDraws();
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Failed to connect to the scraping server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-md font-sans">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Facebook Comment Draw</h2>
      
      <form onSubmit={handlePickWinner} className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Draw Title</label>
          <input
            type="text"
            placeholder="e.g., Weekly Giveaway"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Post URL</label>
          <input
            type="text"
            placeholder="https://www.facebook.com/..."
            value={postUrl}
            onChange={(e) => setPostUrl(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 cursor-pointer"
        >
          {loading ? 'Scraping & Picking Winner...' : 'Run Draw'}
        </button>
      </form>

      {winner && (
        <div className="p-4 mb-6 bg-green-50 border border-green-200 rounded-lg text-center">
          <h4 className="text-sm font-semibold text-green-600 uppercase tracking-wide">Latest Winner</h4>
          <p className="text-xl font-bold text-green-900 mt-1">{winner}</p>
        </div>
      )}

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <p className="text-sm font-semibold text-red-600">{error}</p>
        </div>
      )}

      <hr className="my-6 border-gray-200" />

      <h3 className="text-xl font-bold mb-4 text-gray-800">Past Facebook Draws</h3>
      {draws.length === 0 ? (
        <p className="text-gray-500 text-sm">No past Facebook draws recorded yet.</p>
      ) : (
        <div className="space-y-3">
          {draws.map((d) => (
            <div key={d.id} className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex justify-between items-center">
              <div>
                <h4 className="font-semibold text-gray-800">{d.title} <span className="text-xs font-normal text-gray-500">({d.date})</span></h4>
                <p className="text-sm text-gray-600 mt-1">Winner: <span className="font-medium text-gray-900">{d.winner}</span></p>
              </div>
              <a 
                href={d.url} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                View Post
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}