import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if user is logged in on app start
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchCurrentUser(token);
    }
  }, []);

  const fetchCurrentUser = async (token) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
      setCurrentView(response.data.role === 'admin' ? 'admin_dashboard' : 'user_dashboard');
    } catch (error) {
      localStorage.removeItem('token');
      setCurrentView('login');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
    setCurrentView('login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navigation 
        currentUser={currentUser} 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        logout={logout}
      />
      
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {currentView === 'login' && (
          <LoginForm 
            setCurrentUser={setCurrentUser} 
            setCurrentView={setCurrentView}
            setError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}

        {currentView === 'register' && (
          <RegisterForm 
            setCurrentUser={setCurrentUser} 
            setCurrentView={setCurrentView}
            setError={setError}
            loading={loading}
            setLoading={setLoading}
          />
        )}

        {currentView === 'user_dashboard' && currentUser && (
          <UserDashboard 
            currentUser={currentUser}
            setCurrentView={setCurrentView}
            setError={setError}
          />
        )}

        {currentView === 'admin_dashboard' && currentUser && (
          <AdminDashboard 
            currentUser={currentUser}
            setError={setError}
          />
        )}

        {currentView === 'new_request' && currentUser && (
          <RequestForm 
            currentUser={currentUser}
            setCurrentView={setCurrentView}
            setError={setError}
          />
        )}
      </main>
    </div>
  );
}

// Navigation Component
const Navigation = ({ currentUser, currentView, setCurrentView, logout }) => {
  return (
    <nav className="bg-white shadow-lg border-b-4 border-blue-600">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <h1 className="ml-3 text-2xl font-bold text-gray-900">
                Demandes ESEB
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {currentUser ? (
              <>
                <span className="text-gray-700">
                  Bonjour, {currentUser.first_name}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {currentUser.role === 'admin' ? 'Administrateur' : 
                   currentUser.role === 'teacher' ? 'Enseignant' : 'Étudiant'}
                </span>
                {currentUser.role === 'admin' ? (
                  <button
                    onClick={() => setCurrentView('admin_dashboard')}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Dashboard
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setCurrentView('user_dashboard')}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Mes demandes
                    </button>
                    <button
                      onClick={() => setCurrentView('new_request')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Nouvelle demande
                    </button>
                  </>
                )}
                <button
                  onClick={logout}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <div className="space-x-4">
                <button
                  onClick={() => setCurrentView('login')}
                  className={`font-medium ${currentView === 'login' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                >
                  Connexion
                </button>
                <button
                  onClick={() => setCurrentView('register')}
                  className={`font-medium ${currentView === 'register' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                >
                  Inscription
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

// Login Form Component
const LoginForm = ({ setCurrentUser, setCurrentView, setError, loading, setLoading }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/login`, formData);
      localStorage.setItem('token', response.data.token);
      setCurrentUser(response.data.user);
      setCurrentView(response.data.user.role === 'admin' ? 'admin_dashboard' : 'user_dashboard');
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-8 py-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Connexion
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="votre-email@exemple.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Votre mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Pas de compte ?{' '}
          <button
            onClick={() => setCurrentView('register')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            S'inscrire
          </button>
        </p>
      </div>
    </div>
  );
};

// Register Form Component
const RegisterForm = ({ setCurrentUser, setCurrentView, setError, loading, setLoading }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'student'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, formData);
      localStorage.setItem('token', response.data.token);
      setCurrentUser(response.data.user);
      setCurrentView(response.data.user.role === 'admin' ? 'admin_dashboard' : 'user_dashboard');
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-8 py-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Inscription
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prénom
              </label>
              <input
                type="text"
                required
                value={formData.first_name}
                onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom
              </label>
              <input
                type="text"
                required
                value={formData.last_name}
                onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="votre-email@exemple.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Choisissez un mot de passe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'utilisateur
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="student">Étudiant</option>
              <option value="teacher">Enseignant</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {loading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <button
            onClick={() => setCurrentView('login')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
};

// Request Form Component
const RequestForm = ({ currentUser, setCurrentView, setError }) => {
  const [formData, setFormData] = useState({
    request_type: currentUser.role === 'teacher' ? 'teacher' : 'student',
    devices: [],
    application_requirements: '',
    phone: '',
    address: '',
    parent_first_name: '',
    parent_last_name: '',
    parent_phone: '',
    parent_email: ''
  });
  const [loading, setLoading] = useState(false);

  const handleDeviceChange = (device) => {
    const newDevices = formData.devices.includes(device)
      ? formData.devices.filter(d => d !== device)
      : [...formData.devices, device];
    setFormData({...formData, devices: newDevices});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.devices.length === 0) {
      setError('Veuillez sélectionner au moins un appareil');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_BASE_URL}/api/requests`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Demande soumise avec succès!');
      setCurrentView('user_dashboard');
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-8 py-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Nouvelle Demande d'Appareil
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Device Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Appareils demandés *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 'ipad', name: 'iPad', icon: '📱' },
                { id: 'macbook', name: 'MacBook', icon: '💻' },
                { id: 'apple_pencil', name: 'Apple Pencil', icon: '✏️' }
              ].map(device => (
                <label
                  key={device.id}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.devices.includes(device.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.devices.includes(device.id)}
                    onChange={() => handleDeviceChange(device.id)}
                    className="sr-only"
                  />
                  <span className="text-2xl mr-3">{device.icon}</span>
                  <span className="font-medium">{device.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Application Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exigences d'application *
            </label>
            <textarea
              required
              value={formData.application_requirements}
              onChange={(e) => setFormData({...formData, application_requirements: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="4"
              placeholder="Décrivez vos besoins spécifiques pour les applications et l'utilisation des appareils..."
            />
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="+352 XX XX XX XX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Votre adresse complète"
              />
            </div>
          </div>

          {/* Parent Information for Students */}
          {formData.request_type === 'student' && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Informations des parents/tuteurs
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Prénom du parent *
                  </label>
                  <input
                    type="text"
                    required={formData.request_type === 'student'}
                    value={formData.parent_first_name}
                    onChange={(e) => setFormData({...formData, parent_first_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du parent *
                  </label>
                  <input
                    type="text"
                    required={formData.request_type === 'student'}
                    value={formData.parent_last_name}
                    onChange={(e) => setFormData({...formData, parent_last_name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone du parent
                  </label>
                  <input
                    type="tel"
                    value={formData.parent_phone}
                    onChange={(e) => setFormData({...formData, parent_phone: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+352 XX XX XX XX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email du parent
                  </label>
                  <input
                    type="email"
                    value={formData.parent_email}
                    onChange={(e) => setFormData({...formData, parent_email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="parent@exemple.com"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setCurrentView('user_dashboard')}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? 'Soumission...' : 'Soumettre la demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// User Dashboard Component
const UserDashboard = ({ currentUser, setCurrentView, setError }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data.requests);
    } catch (error) {
      setError('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'en_attente': { text: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      'approuve': { text: 'Approuvé', color: 'bg-green-100 text-green-800' },
      'refuse': { text: 'Refusé', color: 'bg-red-100 text-red-800' },
      'prepare': { text: 'Préparé', color: 'bg-blue-100 text-blue-800' },
      'contacte': { text: 'Contacté', color: 'bg-purple-100 text-purple-800' },
      'termine': { text: 'Terminé', color: 'bg-gray-100 text-gray-800' }
    };
    const statusInfo = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const downloadPDF = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/requests/${requestId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `demande_${requestId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError('Erreur lors du téléchargement du PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Mes Demandes</h2>
        <button
          onClick={() => setCurrentView('new_request')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Nouvelle demande
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">📱</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Aucune demande</h3>
          <p className="text-gray-600 mb-4">
            Vous n'avez encore soumis aucune demande d'appareil.
          </p>
          <button
            onClick={() => setCurrentView('new_request')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Créer ma première demande
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {requests.map(request => (
            <div key={request._id} className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Demande #{request._id.slice(-8)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Soumise le {new Date(request.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(request.status)}
                    <button
                      onClick={() => downloadPDF(request._id)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Télécharger PDF"
                    >
                      📄
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Appareils demandés:</h4>
                    <div className="flex flex-wrap gap-2">
                      {request.devices.map(device => (
                        <span
                          key={device}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          {device.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Type de demande:</h4>
                    <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                      {request.request_type === 'student' ? 'Étudiant' : 'Enseignant'}
                    </span>
                  </div>
                </div>

                {request.application_requirements && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Exigences:</h4>
                    <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded">
                      {request.application_requirements}
                    </p>
                  </div>
                )}

                {request.admin_notes && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Notes administratives:</h4>
                    <p className="text-gray-700 text-sm bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                      {request.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Admin Dashboard Component
const AdminDashboard = ({ currentUser, setError }) => {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRequests(response.data.requests);
    } catch (error) {
      setError('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques');
    }
  };

  const updateRequestStatus = async (requestId, status, deviceInfo = {}, adminNotes = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_BASE_URL}/api/requests/${requestId}`, {
        status,
        device_serial_numbers: deviceInfo.serialNumbers || {},
        device_asset_tags: deviceInfo.assetTags || {},
        admin_notes: adminNotes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchRequests();
      fetchStats();
      setSelectedRequest(null);
      alert('Demande mise à jour avec succès!');
    } catch (error) {
      setError('Erreur lors de la mise à jour');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'en_attente': { text: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
      'approuve': { text: 'Approuvé', color: 'bg-green-100 text-green-800' },
      'refuse': { text: 'Refusé', color: 'bg-red-100 text-red-800' },
      'prepare': { text: 'Préparé', color: 'bg-blue-100 text-blue-800' },
      'contacte': { text: 'Contacté', color: 'bg-purple-100 text-purple-800' },
      'termine': { text: 'Terminé', color: 'bg-gray-100 text-gray-800' }
    };
    const statusInfo = statusMap[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    );
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user_info?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${request.user_info?.first_name} ${request.user_info?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard Administrateur</h2>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total_requests}</div>
            <div className="text-sm text-gray-600">Total des demandes</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending_requests}</div>
            <div className="text-sm text-gray-600">En attente</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-2xl font-bold text-green-600">{stats.approved_requests}</div>
            <div className="text-sm text-gray-600">Approuvées</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="text-2xl font-bold text-gray-600">{stats.completed_requests}</div>
            <div className="text-sm text-gray-600">Terminées</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Rechercher par ID, email ou nom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="approuve">Approuvé</option>
              <option value="refuse">Refusé</option>
              <option value="prepare">Préparé</option>
              <option value="contacte">Contacté</option>
              <option value="termine">Terminé</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Demandeur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Appareils
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map(request => (
                <tr key={request._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {request.user_info?.first_name} {request.user_info?.last_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.user_info?.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {request.devices.map(device => (
                        <span
                          key={device}
                          className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs mr-1"
                        >
                          {device.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.request_type === 'student' ? 'Étudiant' : 'Enseignant'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(request.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Gérer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Management Modal */}
      {selectedRequest && (
        <RequestManagementModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdate={updateRequestStatus}
        />
      )}
    </div>
  );
};

// Request Management Modal Component
const RequestManagementModal = ({ request, onClose, onUpdate }) => {
  const [status, setStatus] = useState(request.status);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [deviceInfo, setDeviceInfo] = useState({
    serialNumbers: request.device_serial_numbers || {},
    assetTags: request.device_asset_tags || {}
  });

  const handleDeviceInfoChange = (device, field, value) => {
    setDeviceInfo(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [device]: value
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(request._id, status, deviceInfo, adminNotes);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              Gérer la demande #{request._id.slice(-8)}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Request Info */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Informations de la demande</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Demandeur:</span><br />
                  {request.user_info?.first_name} {request.user_info?.last_name}<br />
                  {request.user_info?.email}
                </div>
                <div>
                  <span className="font-medium">Type:</span><br />
                  {request.request_type === 'student' ? 'Étudiant' : 'Enseignant'}
                </div>
              </div>
              <div className="mt-2">
                <span className="font-medium">Appareils:</span><br />
                {request.devices.map(device => device.replace('_', ' ')).join(', ')}
              </div>
              <div className="mt-2">
                <span className="font-medium">Exigences:</span><br />
                <p className="text-gray-700 mt-1">{request.application_requirements}</p>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="en_attente">En attente</option>
                <option value="approuve">Approuvé</option>
                <option value="refuse">Refusé</option>
                <option value="prepare">Préparé</option>
                <option value="contacte">Contacté</option>
                <option value="termine">Terminé</option>
              </select>
            </div>

            {/* Device Details */}
            {(status === 'prepare' || status === 'contacte' || status === 'termine') && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Détails des appareils</h4>
                {request.devices.map(device => (
                  <div key={device} className="mb-4 p-4 border border-gray-200 rounded-lg">
                    <h5 className="font-medium text-gray-800 mb-2">
                      {device.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Numéro de série
                        </label>
                        <input
                          type="text"
                          value={deviceInfo.serialNumbers[device] || ''}
                          onChange={(e) => handleDeviceInfoChange(device, 'serialNumbers', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Entrez le numéro de série"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tag d'actif
                        </label>
                        <input
                          type="text"
                          value={deviceInfo.assetTags[device] || ''}
                          onChange={(e) => handleDeviceInfoChange(device, 'assetTags', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Entrez le tag d'actif"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes administratives
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="3"
                placeholder="Ajoutez des notes pour le demandeur..."
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Mettre à jour
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;