(function () {
    'use strict';

    var contactForm = document.getElementById('contact-form');
    var formSuccess = document.getElementById('form-success');

    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();

            var formData = new FormData(contactForm);
            var actionUrl = contactForm.getAttribute('action');

            fetch(actionUrl, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            }).then(function (response) {
                if (response.ok) {
                    contactForm.style.display = 'none';
                    if (formSuccess) {
                        formSuccess.classList.add('is-visible');
                    }
                    contactForm.reset();
                } else {
                    response.json().then(function (data) {
                        if (Object.hasOwn(data, 'errors')) {
                            alert(data["errors"].map(error => error["message"]).join(", "));
                        } else {
                            alert("Oops! There was a problem submitting your form");
                        }
                    });
                }
            }).catch(function (error) {
                alert("Oops! There was a problem submitting your form");
            });
        });
    }
})();
