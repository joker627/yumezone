async function handleRegister(event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('register-btn');
    const errorBox = document.getElementById('register-error');
    
    if (!username || !email || !password) return;
    
    btn.disabled = true;
    btn.textContent = "Registrando...";
    errorBox.classList.remove('visible');

    try {
        const response = await fetch(`${API_URL}/users/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Error al registrarse");
        }

        // Si se registró con éxito, loguear automáticamente
        const loginResponse = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!loginResponse.ok) {
            throw new Error("Registro exitoso, pero fallo al iniciar sesión. Por favor inicia sesión manualmente.");
        }

        const data = await loginResponse.json();
        localStorage.setItem('yumezone_token', data.access_token);
        window.location.href = '/';
        
    } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.add('visible');
    } finally {
        btn.disabled = false;
        btn.textContent = "Registrarse";
    }
}
