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
      setCurrentView(response.data.role === 'admin' ? 'dashboard' : 'my_requests');
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

        {currentView === 'my_requests' && currentUser && (
          <MyRequestsView 
            currentUser={currentUser}
            setCurrentView={setCurrentView}
            setError={setError}
          />
        )}

        {currentView === 'dashboard' && currentUser && currentUser.role === 'admin' && (
          <AdminDashboard 
            currentUser={currentUser}
            setCurrentView={setCurrentView}
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
                <span className="text-white font-bold text-lg">🏛️</span>
              </div>
              <h1 className="ml-3 text-2xl font-bold text-gray-900">
                Demandes EBS - Luxembourg
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
                  {currentUser.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                </span>
                
                <button
                  onClick={() => setCurrentView('my_requests')}
                  className={`font-medium ${currentView === 'my_requests' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                >
                  Mes demandes
                </button>
                
                <button
                  onClick={() => setCurrentView('new_request')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Nouvelle demande
                </button>

                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`font-medium ${currentView === 'dashboard' ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600'}`}
                  >
                    Gestion des demandes
                  </button>
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
      setCurrentView(response.data.user.role === 'admin' ? 'dashboard' : 'my_requests');
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
    role: 'user',
    fonction: '',
    adresse_complete: '',
    telephone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/api/register`, formData);
      localStorage.setItem('token', response.data.token);
      setCurrentUser(response.data.user);
      setCurrentView(response.data.user.role === 'admin' ? 'dashboard' : 'my_requests');
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur d\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-8 py-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Inscription - Centre EBS Luxembourg
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prénom *
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
                Nom *
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
              Email *
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
              Mot de passe *
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
              Fonction
            </label>
            <input
              type="text"
              value={formData.fonction}
              onChange={(e) => setFormData({...formData, fonction: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ex: Gestionnaire administratif, Enseignant..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adresse complète
            </label>
            <input
              type="text"
              value={formData.adresse_complete}
              onChange={(e) => setFormData({...formData, adresse_complete: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ex: 5, rue Thomas Edison - L-1445 Strassen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone
            </label>
            <input
              type="tel"
              value={formData.telephone}
              onChange={(e) => setFormData({...formData, telephone: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ex: (+352) 247-65868"
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
              <option value="user">Utilisateur</option>
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
    devices: [],
    application_requirements: '',
    phone: '',
    address: '',
    lieu_reception: 'Centre Technolink',
    duree_fin_disposition: 'Fin d\'année scolaire',
    beneficiaire: {
      nom: '',
      prenom: '',
      matricule: '',
      ecole: '',
      classe: '',
      qualite_ebs: 'EBS',
      personne_reference: ''
    }
  });
  const [loading, setLoading] = useState(false);

  const handleDeviceChange = (device) => {
    const newDevices = formData.devices.includes(device)
      ? formData.devices.filter(d => d !== device)
      : [...formData.devices, device];
    setFormData({...formData, devices: newDevices});
  };

  const handleBeneficiaireChange = (field, value) => {
    setFormData({
      ...formData,
      beneficiaire: {
        ...formData.beneficiaire,
        [field]: value
      }
    });
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

    // Validate beneficiaire required fields
    const requiredFields = ['nom', 'prenom', 'ecole'];
    for (let field of requiredFields) {
      if (!formData.beneficiaire[field]) {
        setError(`Le champ ${field} du bénéficiaire est requis`);
        setLoading(false);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/requests`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Demande EBS soumise avec succès!');
      setCurrentView('my_requests');
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="px-8 py-6">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">
          🏛️ Nouvelle Demande EBS - Ville de Luxembourg
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Au profit de section */}
          <div className="border-2 border-green-200 bg-green-50 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-green-800">
              👤 Au profit de (Bénéficiaire)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.beneficiaire.nom}
                  onChange={(e) => handleBeneficiaireChange('nom', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.beneficiaire.prenom}
                  onChange={(e) => handleBeneficiaireChange('prenom', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matricule
                </label>
                <input
                  type="text"
                  value={formData.beneficiaire.matricule}
                  onChange={(e) => handleBeneficiaireChange('matricule', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ex: 20241234567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  École *
                </label>
                <input
                  type="text"
                  required
                  value={formData.beneficiaire.ecole}
                  onChange={(e) => handleBeneficiaireChange('ecole', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nom de l'école"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Classe
                </label>
                <input
                  type="text"
                  value={formData.beneficiaire.classe}
                  onChange={(e) => handleBeneficiaireChange('classe', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ex: 6e année"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qualité EBS
                </label>
                <select
                  value={formData.beneficiaire.qualite_ebs}
                  onChange={(e) => handleBeneficiaireChange('qualite_ebs', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="EBS">EBS</option>
                  <option value="ESEB">ESEB</option>
                  <option value="i-EBS">i-EBS</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personne de référence
                </label>
                <input
                  type="text"
                  value={formData.beneficiaire.personne_reference}
                  onChange={(e) => handleBeneficiaireChange('personne_reference', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nom de la personne de référence"
                />
              </div>
            </div>
          </div>

          {/* Device Selection */}
          <div className="border-2 border-blue-200 bg-blue-50 p-6 rounded-lg">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-blue-800">
              💻 Matériel informatique souhaité *
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 'ipad', name: 'iPad avec clavier ergonomique', icon: '📱' },
                { id: 'macbook', name: 'MacBook', icon: '💻' },
                { id: 'apple_pencil', name: 'Apple Pencil', icon: '✏️' }
              ].map(device => (
                <label
                  key={device.id}
                  className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    formData.devices.includes(device.id)
                      ? 'border-blue-500 bg-blue-100'
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
                  <span className="font-medium text-sm">{device.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Application Requirements */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📋 Applications ou logiciels installés *
            </label>
            <textarea
              required
              value={formData.application_requirements}
              onChange={(e) => setFormData({...formData, application_requirements: e.target.value})}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="4"
              placeholder="Décrivez les applications et logiciels nécessaires pour l'usage pédagogique..."
            />
          </div>

          {/* Logistical Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📍 Lieu de réception du matériel
              </label>
              <input
                type="text"
                value={formData.lieu_reception}
                onChange={(e) => setFormData({...formData, lieu_reception: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Centre Technolink"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ⏰ Durée de fin de mise à disposition
              </label>
              <input
                type="text"
                value={formData.duree_fin_disposition}
                onChange={(e) => setFormData({...formData, duree_fin_disposition: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Fin d'année scolaire"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📞 Téléphone
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
                🏠 Adresse
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

          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => setCurrentView('my_requests')}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? 'Soumission...' : 'Soumettre la demande EBS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// My Requests View Component
const MyRequestsView = ({ currentUser, setCurrentView, setError }) => {
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
      a.download = `EBS_demande_officielle_${requestId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('PDF téléchargé avec succès');
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
      setError('Erreur lors du téléchargement du PDF: ' + (error.response?.data?.detail || error.message));
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
        <h2 className="text-2xl font-bold text-gray-900">🏛️ Mes Demandes EBS</h2>
        <button
          onClick={() => setCurrentView('new_request')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Nouvelle demande EBS
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🏛️</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Aucune demande EBS</h3>
          <p className="text-gray-600 mb-4">
            Vous n'avez encore soumis aucune demande d'appareil EBS.
          </p>
          <button
            onClick={() => setCurrentView('new_request')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Créer ma première demande EBS
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {requests.map(request => (
            <div key={request._id} className="bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-blue-600">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Demande EBS #{request._id.slice(-8)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Soumise le {new Date(request.created_at).toLocaleDateString('fr-FR')}
                    </p>
                    {request.beneficiaire && (
                      <p className="text-sm text-blue-600 font-medium">
                        Pour: {request.beneficiaire.prenom} {request.beneficiaire.nom}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(request.status)}
                    <button
                      onClick={() => downloadPDF(request._id)}
                      className="text-blue-600 hover:text-blue-800 text-xl"
                      title="Télécharger PDF officiel"
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

                  {request.beneficiaire && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">École:</h4>
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        {request.beneficiaire.ecole}
                      </span>
                      {request.beneficiaire.classe && (
                        <span className="ml-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                          {request.beneficiaire.classe}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {request.application_requirements && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Applications/Logiciels:</h4>
                    <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded">
                      {request.application_requirements}
                    </p>
                  </div>
                )}

                {request.admin_notes && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Notes du Centre Technolink:</h4>
                    <p className="text-gray-700 text-sm bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                      {request.admin_notes}
                    </p>
                  </div>
                )}

                {/* Show PDF generation status */}
                {request.official_pdf_generated && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">PDF Officiel:</h4>
                    <div className="bg-green-50 p-3 rounded border-l-4 border-green-400 flex items-center justify-between">
                      <div>
                        <span className="text-green-800 font-medium">✅ PDF officiel généré automatiquement</span>
                        {request.pdf_generated_at && (
                          <p className="text-green-600 text-sm">
                            Généré le {new Date(request.pdf_generated_at).toLocaleDateString('fr-FR')} à {new Date(request.pdf_generated_at).toLocaleTimeString('fr-FR')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => downloadPDF(request._id)}
                        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors text-sm"
                      >
                        📄 Télécharger PDF Officiel
                      </button>
                    </div>
                  </div>
                )}
                {/* Show device details if available */}
                {(request.device_serial_numbers || request.device_asset_tags) && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Détails des appareils:</h4>
                    <div className="bg-green-50 p-3 rounded border-l-4 border-green-400">
                      {request.devices.map(device => {
                        const serial = request.device_serial_numbers?.[device];
                        const assetTag = request.device_asset_tags?.[device];
                        if (serial || assetTag) {
                          return (
                            <div key={device} className="text-sm mb-2">
                              <strong>{device.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong>
                              {serial && <span className="ml-2">N° série: {serial}</span>}
                              {assetTag && <span className="ml-2">Asset Tag: {assetTag}</span>}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
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
const AdminDashboard = ({ currentUser, setCurrentView, setError }) => {
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
      
      if (status === 'prepare') {
        alert('Demande mise à jour avec succès! PDF officiel généré automatiquement.');
      } else {
        alert('Demande mise à jour avec succès!');
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };

  const deleteRequest = async (requestId) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette demande ? Cette action est irréversible.')) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${API_BASE_URL}/api/requests/${requestId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        fetchRequests();
        fetchStats();
        alert('Demande supprimée avec succès!');
      } catch (error) {
        setError(error.response?.data?.detail || 'Erreur lors de la suppression');
      }
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
      `${request.user_info?.first_name} ${request.user_info?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${request.beneficiaire?.prenom} ${request.beneficiaire?.nom}`.toLowerCase().includes(searchTerm.toLowerCase());
    
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">🏛️ Gestion des Demandes EBS</h2>
        <button
          onClick={() => setCurrentView('new_request')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Nouvelle demande EBS
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <div className="text-2xl font-bold text-blue-600">{stats.prepared_requests}</div>
            <div className="text-sm text-gray-600">Préparées</div>
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
              placeholder="Rechercher par ID, demandeur, bénéficiaire..."
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
                  Bénéficiaire
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Appareils
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
                      <div className="text-xs text-blue-600">
                        {request.user_info?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {request.beneficiaire?.prenom} {request.beneficiaire?.nom}
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.beneficiaire?.ecole}
                      </div>
                      <div className="text-xs text-green-600">
                        {request.beneficiaire?.qualite_ebs}
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
                    {new Date(request.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => setSelectedRequest(request)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Gérer
                    </button>
                    <button
                      onClick={() => deleteRequest(request._id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Supprimer
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

  const validateAssetTag = (tag) => {
    const pattern = /^H\d{5}$/;
    return !tag || pattern.test(tag);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate asset tags
    for (const device in deviceInfo.assetTags) {
      const tag = deviceInfo.assetTags[device];
      if (tag && !validateAssetTag(tag)) {
        alert(`Asset Tag pour ${device} doit être au format H12345 (H suivi de 5 chiffres)`);
        return;
      }
    }
    
    onUpdate(request._id, status, deviceInfo, adminNotes);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              🏛️ Gérer la demande EBS #{request._id.slice(-8)}
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
            <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Demandeur:</h4>
                <p className="text-sm">
                  {request.user_info?.first_name} {request.user_info?.last_name}<br />
                  {request.user_info?.email}<br />
                  <span className="text-blue-600">
                    {request.user_info?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                  </span>
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Bénéficiaire:</h4>
                <p className="text-sm">
                  {request.beneficiaire?.prenom} {request.beneficiaire?.nom}<br />
                  École: {request.beneficiaire?.ecole}<br />
                  Classe: {request.beneficiaire?.classe}<br />
                  <span className="text-green-600">EBS: {request.beneficiaire?.qualite_ebs}</span>
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Appareils:</h4>
                <p className="text-sm">{request.devices.map(device => device.replace('_', ' ')).join(', ')}</p>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Date:</h4>
                <p className="text-sm">{new Date(request.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            {/* Applications */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Applications/Logiciels demandés:</h4>
              <p className="text-gray-700 text-sm">{request.application_requirements}</p>
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
                <option value="prepare">Préparé (génère PDF officiel)</option>
                <option value="contacte">Contacté</option>
                <option value="termine">Terminé</option>
              </select>
              {status === 'prepare' && (
                <p className="text-blue-600 text-sm mt-1">
                  ⚠️ Le passage au statut "Préparé" génère automatiquement le PDF officiel EBS.
                </p>
              )}
            </div>

            {/* Device Details */}
            {(status === 'approuve' || status === 'prepare' || status === 'contacte' || status === 'termine') && (
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
                          Numéro de série {(device === 'ipad' || device === 'macbook') && '*'}
                        </label>
                        <input
                          type="text"
                          required={(device === 'ipad' || device === 'macbook') && (status === 'approuve' || status === 'prepare')}
                          value={deviceInfo.serialNumbers[device] || ''}
                          onChange={(e) => handleDeviceInfoChange(device, 'serialNumbers', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder={device === 'apple_pencil' ? 'Non requis pour Apple Pencil' : 'Entrez le numéro de série'}
                          disabled={device === 'apple_pencil'}
                        />
                        {device === 'apple_pencil' && (
                          <p className="text-gray-500 text-xs mt-1">Apple Pencil ne nécessite pas de numéro de série</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Asset Tag (Format: H12345)
                        </label>
                        <input
                          type="text"
                          value={deviceInfo.assetTags[device] || ''}
                          onChange={(e) => handleDeviceInfoChange(device, 'assetTags', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                            deviceInfo.assetTags[device] && !validateAssetTag(deviceInfo.assetTags[device])
                              ? 'border-red-500 bg-red-50'
                              : 'border-gray-300'
                          }`}
                          placeholder="H12345"
                          pattern="H\d{5}"
                        />
                        {deviceInfo.assetTags[device] && !validateAssetTag(deviceInfo.assetTags[device]) && (
                          <p className="text-red-600 text-xs mt-1">Format requis: H suivi de 5 chiffres (ex: H12345)</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes du Centre Technolink
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