const chai = require('chai');
const chaiHttp = require('chai-http');
const expect = chai.expect;
chai.use(chaiHttp);

const app = require('./app.js');

describe('User and Project Count Endpoints', () => {
    it('should get the user count', (done) => {
        chai.request(app)
            .get('/userCount')
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('userCount');
                expect(res.body.userCount).to.be.a('number');
                done();
            });
    });

    it('should get the project count', (done) => {
        chai.request(app)
            .get('/projectCount')
            .end((err, res) => {
                if (err) {
                    return done(err);
                }
                expect(res).to.have.status(200);
                expect(res.body).to.have.property('projectCount');
                expect(res.body.projectCount).to.be.a('number');
                done();
            });
    });
});
