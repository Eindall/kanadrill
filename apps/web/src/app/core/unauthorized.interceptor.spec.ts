import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { isSessionCheck, unauthorizedInterceptor } from './unauthorized.interceptor';

describe('unauthorizedInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let clearUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigateByUrl = vi.fn();
    clearUser = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([unauthorizedInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigateByUrl } },
        { provide: AuthService, useValue: { clearUser } },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const fail = (method: string, url: string, status: number) => {
    let error: unknown;
    http.request(method, url).subscribe({ error: (e) => (error = e) });
    controller.expectOne(url).flush('', { status, statusText: 'x' });
    return error;
  };

  it('oublie l\'utilisateur et renvoie vers la connexion sur un 401 de l\'API', () => {
    const error = fail('GET', '/api/reviews/overview', 401);
    expect(clearUser).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
    expect(error).toBeTruthy(); // l'erreur continue de remonter à l'appelant
  });

  it('traite aussi un 401 sur une modification du profil', () => {
    fail('PATCH', '/api/users/me', 401);
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('laisse la vérification initiale du profil gérer son propre 401', () => {
    fail('GET', '/api/users/me', 401);
    expect(clearUser).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('ne réagit pas aux autres erreurs', () => {
    fail('GET', '/api/reviews/overview', 500);
    fail('GET', '/api/reviews/session', 400);
    expect(clearUser).not.toHaveBeenCalled();
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('reconnaît la vérification de session', () => {
    expect(isSessionCheck({ method: 'GET', url: '/api/users/me' })).toBe(true);
    expect(isSessionCheck({ method: 'PATCH', url: '/api/users/me' })).toBe(false);
    expect(isSessionCheck({ method: 'GET', url: '/api/users/me/sessions' })).toBe(false);
  });
});
