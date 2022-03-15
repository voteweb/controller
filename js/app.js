/*!
 * Voteweb Controller 1.0.0
 * https://github.com/voteweb/controller
 * https://www.voteweb.fr
 *
 * Copyright 2022 Voteweb authors
 * @license CC BY-NC-SA 4.0
 * https://creativecommons.org/licenses/by-nc-sa/4.0/
 */

/*
 * Legacy JS is used to allow greater browser compatibility.
 * Supported browsers:
 * Browser version | Released year | Functionality inducing this version
 * IE 11 | 2013 | HTMLElement.dataset
 * Edge 12 | 2015 | classList.remove, HTMLElement.dataset
 * Firefox 6 | 2011 | HTMLElement.dataset
 * Chrome 8 | 2010 | classList.remove, HTMLElement.dataset
 * Opera 12.1 | 2012 | classList.remove
 * Safari 5.1 | 2011 | classList.remove && HTMLElement.dataset
 */
const App = (function() {

    function getForm(formElement) {
        switch (formElement.dataset.controlType) {
            case 'integrity':
                return new IntegrityForm(formElement);
                break;
            case 'presence':
                return new PresenceForm(formElement);
                break;
            default:
                displayError('Erreur de configuration du formulaire.');
        }
    }

    function start() {
        const formElement = document.getElementById('control-form');
        formElement.addEventListener('submit', function(e) {
            try {
                e.preventDefault();
                const form = getForm(formElement);
                makeJsonRequest(
                    form.getUrl(),
            {
                        data: form.getData(),
                        successHandler: function successHandler(response) {
                            // we can not attach the handler directly or this in the handler will refer to document
                            form.successHandler(response);
                        }
                    }
                );
            } catch (e) {
                if (e instanceof SyntaxError) {
                    displayError('Les éléments de contrôle fournis sont mal formatés. Assurez-vous de les avoir collés sans modification.');
                } else {
                    displayError('Erreur inconnue. Contactez le support technique si elle se reproduit avec le détail suivant : "' + e + '"');
                }
            }
        });
    }

    function Form(formElement) {
        this.el = formElement;
        this.controlElements = JSON.parse(this.el.querySelector('#control-elements').value);
        this.getUrl = function getUrl() {
            const suffix = 'voteweb.fr';
            const domain = this.controlElements.d;
            if (domain.indexOf(suffix, domain.length - suffix.length) === -1) {
                throw 'Domaine incorrect';
            }
            return 'https://' + domain + this.path;
        }
        this.renderHeader = function renderHeader(response) {
            return '<h3 class="fs-4 text-center">' + response.voteLabel + ' <small class="text-muted">' + response.voteSubLabel + '</small></h3>' +
                '<p class="text-center">' + response.electionLabel + (response.ballotTitle ? ' - ' + response.ballotTitle : '') + '</p>';
        }
        this.renderFooter = function renderFooter() {
            return '<p class="text-center mt-3"><a class="btn btn-outline-secondary" href=""><i class="bi bi-arrow-left-circle-fill"></i> Retour</a></p>';
        }
    }

    function IntegrityForm(formElement) {
        Form.call(this, formElement);
        this.path = '/ballot-papers/control-integrity';
        this.getData = function getData() {
            return {
                p: this.controlElements.p,
            }
        },
        this.successHandler = function successHandler(response) {
            try {
                const ballotPaper = decrypt(this.controlElements.c, this.controlElements.k, this.controlElements.i);
                const ballotBuilder = new BallotBuilder(ballotPaper, response);

                if (response.voteLabel) {
                    this.el.innerHTML =
                        this.renderHeader(response) +
                        '<div class="alert alert-green text-center" role="alert">' +
                            '<i class="bi bi-check-circle-fill fs-5"></i> ' +
                            '<span>Les éléments de contrôle donnés correspondent au bulletin ci-dessous.</span>' +
                        '</div>' +
                        ballotBuilder.render() +
                        this.renderFooter()
                    ;
                } else {
                    displayError(
                        'Les données retournées par le serveur sont incorrectes.' +
                        'Si le problème persiste, contactez le support technique.'
                    );
                }
            } catch (e) {
                displayError(e);
            }
        }
    }

    IntegrityForm.prototype = Object.create(Form.prototype);
    IntegrityForm.prototype.constructor = IntegrityForm;

    function PresenceForm(form) {
        Form.call(this, form);
        this.path = '/ballot-papers/control-presence';
        this.getData = function getData() {
            return {
                p: this.controlElements.p,
                f: this.controlElements.f,
            }
        },
        this.successHandler = function successHandler(response) {
            if (response.b === this.controlElements.b) {
                this.el.innerHTML =
                    this.renderHeader(response) +
                    '<div class="alert alert-green text-center" role="alert">' +
                        '<i class="bi bi-envelope-check-fill fs-5"></i> ' +
                        '<span>Votre bulletin est bien présent dans l’urne et n’a pas été modifié.</span>' +
                    '</div>' +
                    '<div class="card text-center">' +
                        '<div class="card-header">Valeur du bulletin chiffré dans l’urne</div>' +
                        '<div class="card-body"><pre>' + response.b + '</pre></div>' +
                    '</div>' +
                    this.renderFooter()
                ;
            } else {
                displayError(
                    'Le bulletin chiffré fourni ne correspond pas à l’empreinte associée. ' +
                    'Assurez-vous d’avoir collé les éléments de contrôle sans modification. ' +
                    'Si le problème persiste, contactez le support technique.'
                );
            }
        }
    }

    PresenceForm.prototype = Object.create(Form.prototype);
    PresenceForm.prototype.constructor = PresenceForm;

    function displayError(error) {
        const errorPanel = document.querySelector('[data-error-panel]');
        if (errorPanel) {
            errorPanel.querySelector('span').textContent = error;
            errorPanel.classList.remove('d-none');
        } else {
            alert(error);
        }
    }

    function makeJsonRequest(url, options) {
        options = options || {};
        const method = options.method || 'POST';
        const data = options.data || {};
        const successHandler = options.successHandler || null;

        const httpRequest = new XMLHttpRequest();
        httpRequest.onreadystatechange = function () {
            if (httpRequest.readyState === XMLHttpRequest.DONE) {
                if (httpRequest.status === 200) {
                    if (typeof successHandler === 'function') {
                        try {
                            const response = JSON.parse(httpRequest.responseText);
                            successHandler(response);
                        } catch (e) {
                            displayError('Erreur. La réponse du serveur est incorrecte.');
                        }
                    }
                } else {
                    try {
                        const response = JSON.parse(httpRequest.responseText);
                        displayError(response.error);
                    } catch (e) {
                        displayError('Erreur. La réponse du serveur est incorrecte. Statut ' + httpRequest.status);
                    }
                }
            }
        };
        httpRequest.open(method, url);
        httpRequest.setRequestHeader('Content-Type', 'application/json');
        httpRequest.timeout = 60 * 1000; // 60 seconds
        httpRequest.ontimeout = function () {
            displayError('Impossible de joindre le serveur.');
        };
        httpRequest.send(JSON.stringify(data));
    }

    function decrypt(cipherTextWithTag, key, iv) {
        try {
            const cipherText = cipherTextWithTag.substring(0, cipherTextWithTag.length - 32);
            const tag = cipherTextWithTag.substring(cipherTextWithTag.length - 32);
            const decipher = forge.cipher.createDecipher('AES-GCM', forge.util.hexToBytes(key));
            decipher.start({
                iv: forge.util.hexToBytes(iv),
                tagLength: 128,
                tag: forge.util.hexToBytes(tag),
            });
            decipher.update(forge.util.createBuffer(forge.util.hexToBytes(cipherText)));
            if (!decipher.finish()) {
                throw 'Échec du déchiffrement.'
            }
            try {
                return JSON.parse(decipher.output.toString().split('#')[0]);
            } catch (e) {
                return {};
            }
        } catch (e) {
            throw 'Échec du déchiffrement. Assurez-vous d’avoir collé les éléments de contrôle sans modification.'
        }
    }

    function BallotBuilder(ballotPaper, response) {

        var candidates, questions, questionsApprovalLabel, questionsRefusalLabel, isBlank;

        if (typeof response !== 'object') {
            throw 'La réponse du serveur est incorrecte. Contactez le support technique.';
        }

        init(ballotPaper);

        function init(ballotPaper) {
            candidates = response.candidates || null;
            questions = response.questions || null;
            questionsApprovalLabel = response.questionsApprovalLabel || null;
            questionsRefusalLabel = response.questionsRefusalLabel || null;
            isBlank = false;

            if (Object.keys(ballotPaper).length === 0) {
                throw 'Le bulletin est vide et sera comptabilisé comme un nul.';
            }
            delete ballotPaper.userCategoryId;
            delete ballotPaper.pollingStationId;

            isBlank = ballotPaper[0] === 'blank';
            if (isBlank) {
                return;
            }

            const ids = candidates ? candidates : questions;
            Object.keys(ballotPaper).forEach(function(id) {
                if (!ids[id]) {
                    throw 'Le bulletin est invalide et sera comptabilisé comme un nul.';
                }
            });
        }

        this.render = function render() {
            var output =
                '<div class="card text-center">' +
                    '<div class="card-header">' + getBallotPaperTitle() + '</div>' +
                    '<ul class="list-group list-group-flush">' + (isBlank ? renderBlank() : candidates ? renderCandidates() : renderQuestions()) + '</ul>' +
                '</div>'
            ;
            return output;
        }

        function getBallotPaperTitle() {
            if (isBlank) {
                return 'Bulletin';
            }
            const items = candidates ? candidates : questions;
            return items[Object.keys(ballotPaper)[0]].ballotPaperTitle || 'Bulletin';
        }

        function renderBlank() {
            return '<li class="list-group-item">Blanc</li>';
        }

        function renderCandidates() {
            var output = '';
            const ballotPaperCandidateIds =  Object.keys(ballotPaper);
            ballotPaperCandidateIds.forEach(function(candidateId) {
                const candidate = candidates[candidateId];
                const candidateChecked = ballotPaper[candidateId] === 1;

                output += '<li class="list-group-item">';
                output += candidateChecked ? '<i class="bi bi-check-square text-green"></i> ' : '<i class="bi bi-x-square text-danger"></i> <s>';
                output += candidate.firstName + ' ' + candidate.lastName;
                output += candidateChecked ? '' : '</s>';
                output += '</li>';
            });
            return output;
        }

        function renderQuestions() {
            var output = '';
            const answers = {
                yes: {
                    label: questionsApprovalLabel,
                    icon: 'bi-check-square text-green',
                },
                no: {
                    label: questionsRefusalLabel,
                    icon: 'bi-x-square text-danger',
                },
                abstention: {
                    label: 'Abstention',
                    icon: 'bi-slash-square text-primary'
                },
                blank: {
                    label: 'Blanc',
                    icon: 'bi-square',
                },
            };
            const ballotPaperQuestionIds =  Object.keys(ballotPaper);
            ballotPaperQuestionIds.forEach(function(questionId) {
                const question = questions[questionId];
                const questionValue = ballotPaper[questionId];
                const label = answers[questionValue] !== undefined ? answers[questionValue].label : 'Nul';
                const icon = answers[questionValue] !== undefined ? answers[questionValue].icon : 'bi-exclamation-square text-danger';

                output += '<li class="list-group-item text-start d-flex">';
                output += '<span class="flex-grow-1">' + question.position + ' - ' + question.label + '</span>';
                output += '<i class="bi ' + icon + '" aria-label="' + label + '" title="' + label + '"></i> ';
                output += '</li>';
            });
            return output;
        }
    }

    return {
        start: start,
    }

})();
App.start();