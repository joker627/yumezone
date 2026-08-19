async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const errorBox = document.getElementById('login-error');
    
    if (!email || !password) return;
    
    btn.disabled = true;
    btn.textContent = "Verificando...";
    errorBox.classList.remove('visible');

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Error al iniciar sesión");
        }

        const data = await response.json();
        localStorage.setItem('yumezone_token', data.access_token);
        window.location.href = '/';
        
    } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.textContent = "Iniciar Sesión";
    }
}
