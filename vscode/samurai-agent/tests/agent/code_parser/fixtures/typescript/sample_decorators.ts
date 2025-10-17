// TypeScript Decorators Test Fixture
// Tests annotation element extraction

function Component(config: any) {
    return function (target: any) {
        // Decorator implementation
    };
}

function Injectable() {
    return function (target: any) {
        // Decorator implementation
    };
}

function LogMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    // Method decorator
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent {
    @LogMethod
    initialize() {
        console.log('Initializing...');
    }
}

@Injectable()
export class UserService {
    getUsers() {
        return [];
    }
}

